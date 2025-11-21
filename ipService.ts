import { IpInfo } from '../types';

export const fetchIpInfo = async (): Promise<IpInfo> => {
  try {
    // 尝试获取 IP 信息。 ipapi.co 是一个常用的免费接口。
    // 如果在国内访问较慢，可以考虑更换为 ip-api.com 或其他国内 IP 库 API
    const response = await fetch('https://ipapi.co/json/');
    
    if (!response.ok) {
      throw new Error('IP Network request failed');
    }
    
    const data = await response.json();
    
    return {
      ip: data.ip || '未知',
      city: data.city || '',
      region: data.region || '',
      country: data.country_name || '',
      org: data.org || data.asn || '未知运营商',
    };
  } catch (error) {
    console.warn("Primary IP fetch failed, trying fallback...", error);
    // 简单的 Fallback，仅获取 IP
    try {
        const fallback = await fetch('https://api.db-ip.com/v2/free/self');
        const data = await fallback.json();
        return {
            ip: data.ipAddress,
            city: data.city,
            region: data.regionName, // Note: field names vary by API
            country: data.countryName,
            org: 'Unknown'
        }
    } catch (e) {
        throw new Error("无法获取网络信息");
    }
  }
};
