export const MOCK_SAN_JOSE_311_RESPONSE = [
  {
    service_request_id: "SJ311-2026-0417-1001",
    service_code: "DOT_POTHOLE",
    service_name: "Pothole",
    status: "open",
    requested_datetime: "2026-04-17T16:42:00-07:00",
    updated_datetime: "2026-04-18T08:20:00-07:00",
    address: "S 2nd St & E San Carlos St, San Jose, CA",
    description: "Deep pothole in the southbound lane near the bus stop.",
    lat: "37.333721",
    long: "-121.887219",
    media_url: null
  },
  {
    service_request_id: "SJ311-2026-0414-0872",
    service_code: "DOT_POTHOLE",
    service_name: "Pothole",
    status: "closed",
    requested_datetime: "2026-04-14T11:09:00-07:00",
    updated_datetime: "2026-04-20T14:13:00-07:00",
    address: "The Alameda & Race St, San Jose, CA",
    description: "Multiple potholes reported along the right lane.",
    lat: "37.332725",
    long: "-121.912992",
    media_url: null
  },
  {
    service_request_id: "SJ311-2026-0418-1118",
    service_code: "DOT_POTHOLE",
    service_name: "Pothole",
    status: "open",
    requested_datetime: "2026-04-18T09:51:00-07:00",
    updated_datetime: "2026-04-18T10:04:00-07:00",
    address: "Meridian Ave & Willow St, San Jose, CA",
    description: "Pothole forming near the bike lane.",
    lat: "37.308141",
    long: "-121.913805",
    media_url: null
  },
  {
    service_request_id: "SJ311-2026-0409-0510",
    service_code: "DOT_POTHOLE",
    service_name: "Pothole",
    status: "closed",
    requested_datetime: "2026-04-09T07:28:00-07:00",
    updated_datetime: "2026-04-12T15:49:00-07:00",
    address: "N 10th St & Jackson St, San Jose, CA",
    description: "Road depression patched after earlier report.",
    lat: "37.353241",
    long: "-121.887351",
    media_url: null
  },
  {
    service_request_id: "SJ311-2026-0419-1230",
    service_code: "DOT_POTHOLE",
    service_name: "Pothole",
    status: "open",
    requested_datetime: "2026-04-19T13:11:00-07:00",
    updated_datetime: "2026-04-19T13:29:00-07:00",
    address: "Berryessa Rd & Lundy Ave, San Jose, CA",
    description: "Large pothole near the center turn lane.",
    lat: "37.386297",
    long: "-121.876719",
    media_url: null
  },
  {
    service_request_id: "SJ311-2026-0416-0951",
    service_code: "DOT_POTHOLE",
    service_name: "Pothole",
    status: "open",
    requested_datetime: "2026-04-16T17:05:00-07:00",
    updated_datetime: "2026-04-17T08:11:00-07:00",
    address: "Aborn Rd & White Rd, San Jose, CA",
    description: "Pothole at the intersection after recent rain.",
    lat: "37.309159",
    long: "-121.795157",
    media_url: null
  },
  {
    service_request_id: "SJ311-2026-0411-0644",
    service_code: "DOT_POTHOLE",
    service_name: "Pothole",
    status: "closed",
    requested_datetime: "2026-04-11T12:35:00-07:00",
    updated_datetime: "2026-04-15T09:30:00-07:00",
    address: "Winchester Blvd & Stevens Creek Blvd, San Jose, CA",
    description: "Fixed pothole outside the shopping corridor.",
    lat: "37.322725",
    long: "-121.950484",
    media_url: null
  },
  {
    service_request_id: "SJ311-2026-0420-1317",
    service_code: "DOT_POTHOLE",
    service_name: "Pothole",
    status: "open",
    requested_datetime: "2026-04-20T15:44:00-07:00",
    updated_datetime: "2026-04-20T15:55:00-07:00",
    address: "Camden Ave & Union Ave, San Jose, CA",
    description: "Wheel-impact pothole in the northbound lane.",
    lat: "37.260384",
    long: "-121.929738",
    media_url: null
  }
];

export const MOCK_POTHOLES = MOCK_SAN_JOSE_311_RESPONSE.map((record, index) => ({
  id: record.service_request_id,
  source: "San Jose 311",
  title: `${record.service_name} report ${index + 1}`,
  status: record.status === "closed" ? "fixed" : "reported",
  severity: index % 3 === 0 ? "High" : index % 2 === 0 ? "Medium" : "Low",
  notes: record.description,
  address: record.address,
  requestedAt: record.requested_datetime,
  updatedAt: record.updated_datetime,
  coordinate: {
    latitude: Number(record.lat),
    longitude: Number(record.long)
  },
  raw: record
}));
