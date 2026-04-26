export interface HeritageResult {
  heritage: boolean;
  conservation_area: boolean;
  planning_restricted: boolean;
}

export async function checkHeritage(lat: number, lng: number): Promise<HeritageResult> {
  // Historic Environment Division NI — spatial query by coordinates
  const url = `https://maps.communities-ni.gov.uk/server/rest/services/HED/HED_Listed_Buildings/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json&distance=30&units=esriSRUnit_Meter`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (res.ok) {
      const data = await res.json();
      const hasListing = (data?.features?.length ?? 0) > 0;
      return { heritage: hasListing, conservation_area: hasListing, planning_restricted: hasListing };
    }
  } catch {
    // Heritage API unavailable — return safe defaults
  }

  return { heritage: false, conservation_area: false, planning_restricted: false };
}
