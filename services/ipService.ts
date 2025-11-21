import { IpInfo } from '../types';

interface RequestInitWithTimeout extends RequestInit {
  timeout?: number;
}

// Helper to timeout fetch requests
const fetchWithTimeout = async (resource: string, options: RequestInitWithTimeout = {}) => {
  const { timeout = 5000, ...rest } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const response = await fetch(resource, {
    ...rest,
    signal: controller.signal  
  });
  clearTimeout(id);
  return response;
};

export const fetchIpInfo = async (): Promise<IpInfo> => {
  try {
    // Primary: db-ip.com (Reliable free tier, JSON output)
    // Usually faster than ipapi.co in Asia
    const response = await fetchWithTimeout('https://api.db-ip.com/v2/free/self', { timeout: 5000 });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    
    return {
      ip: data.ipAddress || '未知',
      city: data.city || '',
      region: data.regionName || '',
      country: data.countryName || '',
      org: 'Unknown Provider', // db-ip free tier doesn't always provide ISP
    };
  } catch (error) {
    console.warn("Primary IP fetch failed, trying fallback...", error);
    
    // Fallback: ipapi.co (Excellent data but strict rate limits)
    try {
        const fallback = await fetchWithTimeout('https://ipapi.co/json/', { timeout: 5000 });
        if (!fallback.ok) throw new Error("Fallback failed");
        
        const data = await fallback.json();
        return {
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country_name,
            org: data.org || data.asn
        }
    } catch (e) {
        // Last resort: ipify (IP Only)
        try {
            const ipOnly = await fetchWithTimeout('https://api.ipify.org?format=json', { timeout: 3000 });
            const ipData = await ipOnly.json();
            return {
                ip: ipData.ip,
                city: '',
                region: '',
                country: '',
                org: ''
            };
        } catch (finalErr) {
            throw new Error("无法获取网络信息");
        }
    }
  }
};