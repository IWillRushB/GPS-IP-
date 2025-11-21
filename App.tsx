import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { IpInfo, GpsCoordinates, AddressInfo, LocationStatus } from './types';
import { fetchIpInfo } from './services/ipService';

export default function App() {
  const [ipData, setIpData] = useState<IpInfo | null>(null);
  const [gpsData, setGpsData] = useState<GpsCoordinates | null>(null);
  const [addressData, setAddressData] = useState<AddressInfo | null>(null);
  
  const [status, setStatus] = useState<LocationStatus>(LocationStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  // Ref to track if we have already started the geocoding process for a specific set of coords
  const lastResolvedCoords = useRef<{lat: number, lng: number} | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // 1. 初始化数据获取 (IP & GPS)
  useEffect(() => {
    loadLocationData();
  }, []);

  // 2. 当 GPS 准备好时，使用 Gemini (Google Maps) 执行地址解析
  useEffect(() => {
    if (gpsData) {
      // 简单的防抖，避免重复解析相同坐标
      if (lastResolvedCoords.current?.lat === gpsData.latitude && 
          lastResolvedCoords.current?.lng === gpsData.longitude) {
        return;
      }
      resolveAddressWithGemini(gpsData.latitude, gpsData.longitude);
    }
  }, [gpsData]);

  const loadLocationData = async () => {
    if (!isMounted.current) return;
    setStatus(LocationStatus.LOADING);
    setErrorMsg("");
    setAddressData(null);
    lastResolvedCoords.current = null;

    // A. 获取 IP 信息
    fetchIpInfo()
      .then(data => {
        if (isMounted.current) setIpData(data);
      })
      .catch(e => {
        console.warn("IP Fetch warning:", e);
      });

    // B. 获取 GPS
    if (!navigator.geolocation) {
      setStatus(LocationStatus.ERROR);
      setErrorMsg("您的浏览器不支持定位功能");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMounted.current) return;
        const { latitude, longitude, accuracy } = position.coords;
        setGpsData({
          latitude,
          longitude,
          accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        if (!isMounted.current) return;
        setStatus(LocationStatus.DENIED);
        let msg = "定位失败";
        switch(error.code) {
          case 1: msg = "请允许浏览器获取您的位置权限"; break;
          case 2: msg = "GPS 信号弱，无法获取位置"; break;
          case 3: msg = "定位请求超时"; break;
          default: msg = error.message;
        }
        setErrorMsg(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // 使用 Gemini + Google Maps Grounding 解析地址
  const resolveAddressWithGemini = async (lat: number, lng: number) => {
    lastResolvedCoords.current = { lat, lng };

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 我们不需要 coordinate conversion，因为 Google Maps 使用标准的 WGS84
      const prompt = `Where is latitude ${lat}, longitude ${lng}? Provide the precise street address in Chinese.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{googleMaps: {}}],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        },
      });

      if (!isMounted.current) return;

      // Grounding responses usually contain the text in response.text
      // We can also look at groundingChunks for precise POI data, but for now we take the text summary.
      const resultText = response.text;
      
      if (resultText) {
        setAddressData({
          formattedAddress: resultText.trim(),
          poiName: "Google Maps Data"
        });
        setStatus(LocationStatus.SUCCESS);
      } else {
        setStatus(LocationStatus.SUCCESS); // Soft fail
        setAddressData({ formattedAddress: "无法解析详细地址", poiName: "" });
      }

    } catch (e) {
      console.error("Gemini Maps Grounding error:", e);
      if (isMounted.current) {
        setStatus(LocationStatus.SUCCESS); // We still have GPS, just no address
        setAddressData({ formattedAddress: "地址解析超时或失败", poiName: "" });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4 max-w-md mx-auto transition-colors font-sans">
      
      {/* 头部标题 */}
      <header className="w-full mb-6 flex items-center justify-between">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 dark:text-white">位置助手</h1>
           <p className="text-xs text-slate-500 dark:text-slate-400">
             Global GPS & IP Tracker
           </p>
        </div>
        <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
        </div>
      </header>

      {/* 错误提示条 */}
      {errorMsg && (
        <div className="w-full mb-6 p-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-300 rounded-lg text-sm font-medium text-center animate-fade-in">
          {errorMsg}
        </div>
      )}

      <main className="w-full space-y-4">

        {/* 卡片 1: 详细地址 (重点展示) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative min-h-[160px]">
          {status === LocationStatus.LOADING && (
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-blue-500 animate-linear-progress"></div>
            </div>
          )}
          
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">当前 GPS 所在位置</h2>
              {status === LocationStatus.SUCCESS && (
                 <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                 </span>
              )}
            </div>

            {status === LocationStatus.LOADING ? (
              <div className="animate-pulse space-y-3 py-2">
                <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded w-4/5"></div>
                <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-2/3"></div>
              </div>
            ) : addressData ? (
              <div className="animate-fade-in">
                <div className="text-lg font-medium text-slate-900 dark:text-white leading-normal mb-2 break-words">
                  {addressData.formattedAddress}
                </div>
                <div className="flex items-center gap-1 mt-2">
                   <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" alt="Google" className="w-4 h-4 opacity-70" />
                   <span className="text-xs text-slate-400">Powered by Google Maps</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 py-4 text-center text-sm">
                {status === LocationStatus.DENIED ? "无法获取位置权限" : errorMsg ? "位置获取异常" : "正在等待 GPS 信号..."}
              </div>
            )}
          </div>

          {/* 经纬度底栏 */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 px-5 py-3 flex justify-between items-center text-[10px] font-mono text-slate-500 absolute bottom-0 w-full">
            <span className="uppercase">WGS84</span>
            <span>
              {gpsData ? `${gpsData.latitude.toFixed(6)}, ${gpsData.longitude.toFixed(6)}` : "--, --"}
            </span>
          </div>
        </div>

        {/* 卡片 2: IP 信息 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-purple-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S12 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S12 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">网络 IP 详情</span>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">公网 IP</span>
              <span className="font-mono font-medium text-sm text-slate-800 dark:text-slate-200">
                {ipData ? ipData.ip : "查询中..."}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">运营商</span>
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 text-right max-w-[60%] truncate">
                {ipData ? ipData.org : "--"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">IP 归属地</span>
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {ipData ? `${ipData.city} ${ipData.region} ${ipData.country}` : "--"}
              </span>
            </div>
          </div>
        </div>

        {/* 刷新按钮 */}
        <button 
          onClick={loadLocationData}
          disabled={status === LocationStatus.LOADING}
          className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold shadow-md active:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 text-sm"
        >
          {status === LocationStatus.LOADING ? (
             <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>正在刷新...</span>
             </>
          ) : "刷新位置信息"}
        </button>

      </main>
      
      <style>{`
        @keyframes linear-progress {
          0% { width: 0%; margin-left: 0; }
          50% { width: 50%; margin-left: 25%; }
          100% { width: 100%; margin-left: 100%; }
        }
        .animate-linear-progress {
          animation: linear-progress 1.5s infinite linear;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
