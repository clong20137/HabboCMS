import { useEffect, useState } from "react";
import { api } from "../api/client";

let cachedHotelName: string | null = null;

async function getHotelName(): Promise<string> {
  if (cachedHotelName) return cachedHotelName;

  try {
    const data = await api.getSiteConfig();
    cachedHotelName = data.hotelName || "Hotel";
    return cachedHotelName;
  } catch {
    return "Hotel";
  }
}

export function useHotelTitle(page: string) {
  const [hotelName, setHotelName] = useState<string>("Hotel");

  useEffect(() => {
    getHotelName().then(setHotelName);
  }, []);

  useEffect(() => {
    document.title = `${hotelName}: ${page}`;
  }, [hotelName, page]);
}
