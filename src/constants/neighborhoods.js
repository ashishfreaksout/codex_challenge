export const BAY_AREA_CENTER = {
  latitude: 37.55,
  longitude: -122.05
};

export const BAY_AREA_INITIAL_REGION = {
  ...BAY_AREA_CENTER,
  latitudeDelta: 0.78,
  longitudeDelta: 0.9
};

export const BAY_AREA_LOCATIONS = [
  {
    id: "san-francisco",
    name: "San Francisco",
    coordinate: { latitude: 37.7749, longitude: -122.4194 }
  },
  {
    id: "oakland",
    name: "Oakland",
    coordinate: { latitude: 37.8044, longitude: -122.2712 }
  },
  {
    id: "berkeley",
    name: "Berkeley",
    coordinate: { latitude: 37.8715, longitude: -122.273 }
  },
  {
    id: "daly-city",
    name: "Daly City",
    coordinate: { latitude: 37.6879, longitude: -122.4702 }
  },
  {
    id: "san-mateo",
    name: "San Mateo",
    coordinate: { latitude: 37.5629, longitude: -122.3255 }
  },
  {
    id: "redwood-city",
    name: "Redwood City",
    coordinate: { latitude: 37.4852, longitude: -122.2364 }
  },
  {
    id: "palo-alto",
    name: "Palo Alto",
    coordinate: { latitude: 37.4419, longitude: -122.143 }
  },
  {
    id: "mountain-view",
    name: "Mountain View",
    coordinate: { latitude: 37.3861, longitude: -122.0839 }
  },
  {
    id: "sunnyvale",
    name: "Sunnyvale",
    coordinate: { latitude: 37.3688, longitude: -122.0363 }
  },
  {
    id: "santa-clara",
    name: "Santa Clara",
    coordinate: { latitude: 37.3541, longitude: -121.9552 }
  },
  {
    id: "downtown",
    name: "Downtown San Jose",
    coordinate: { latitude: 37.3352, longitude: -121.8906 }
  },
  {
    id: "willow-glen",
    name: "Willow Glen",
    coordinate: { latitude: 37.3083, longitude: -121.8998 }
  },
  {
    id: "japantown",
    name: "Japantown",
    coordinate: { latitude: 37.3487, longitude: -121.8947 }
  },
  {
    id: "alum-rock",
    name: "Alum Rock",
    coordinate: { latitude: 37.3661, longitude: -121.8287 }
  },
  {
    id: "berryessa",
    name: "Berryessa",
    coordinate: { latitude: 37.3861, longitude: -121.8594 }
  },
  {
    id: "evergreen",
    name: "Evergreen",
    coordinate: { latitude: 37.3092, longitude: -121.7717 }
  },
  {
    id: "cambrian",
    name: "Cambrian Park",
    coordinate: { latitude: 37.2569, longitude: -121.9308 }
  },
  {
    id: "rose-garden",
    name: "Rose Garden",
    coordinate: { latitude: 37.3334, longitude: -121.9283 }
  },
  {
    id: "santana-row",
    name: "Santana Row",
    coordinate: { latitude: 37.3202, longitude: -121.9478 }
  },
  {
    id: "north-san-jose",
    name: "North San Jose",
    coordinate: { latitude: 37.4186, longitude: -121.9442 }
  },
  {
    id: "milpitas",
    name: "Milpitas",
    coordinate: { latitude: 37.4323, longitude: -121.8996 }
  },
  {
    id: "fremont",
    name: "Fremont",
    coordinate: { latitude: 37.5485, longitude: -121.9886 }
  },
  {
    id: "hayward",
    name: "Hayward",
    coordinate: { latitude: 37.6688, longitude: -122.0808 }
  },
  {
    id: "union-city",
    name: "Union City",
    coordinate: { latitude: 37.5934, longitude: -122.0438 }
  },
  {
    id: "walnut-creek",
    name: "Walnut Creek",
    coordinate: { latitude: 37.9101, longitude: -122.0652 }
  },
  {
    id: "richmond",
    name: "Richmond",
    coordinate: { latitude: 37.9358, longitude: -122.3477 }
  },
  {
    id: "alameda",
    name: "Alameda",
    coordinate: { latitude: 37.7652, longitude: -122.2416 }
  }
];

export const SAN_JOSE_CENTER = BAY_AREA_CENTER;
export const SAN_JOSE_INITIAL_REGION = BAY_AREA_INITIAL_REGION;
export const SAN_JOSE_NEIGHBORHOODS = BAY_AREA_LOCATIONS;
