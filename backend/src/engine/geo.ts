// Approximate real-world geography used to turn "same state" recruiting logic
// into genuine city-to-city distance. Coordinates are hand-compiled
// best-effort approximations (good enough to rank "closer vs. farther"
// realistically) rather than survey-grade geocoding — same spirit as the rest
// of this game's flavor data (real team/conference names, real EYBL programs)
// where plausibility matters more than pinpoint precision.

// Rough geographic center of each state/DC, used as a fallback anchor when a
// specific city isn't in CITY_COORDS below.
export const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AK: [64.2, -149.4], AZ: [34.2, -111.9], AR: [34.9, -92.4], CA: [37.2, -119.6],
  CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5], DC: [38.9, -77.0], FL: [28.6, -82.4],
  GA: [32.6, -83.4], HI: [20.3, -156.3], ID: [44.4, -114.6], IL: [40.0, -89.2], IN: [39.9, -86.3],
  IA: [42.0, -93.5], KS: [38.5, -98.4], KY: [37.5, -85.3], LA: [31.0, -92.0], ME: [45.4, -69.2],
  MD: [39.0, -76.7], MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7],
  MO: [38.5, -92.5], MT: [47.0, -109.6], NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6],
  NJ: [40.2, -74.7], NM: [34.5, -106.1], NY: [42.9, -75.5], NC: [35.6, -79.4], ND: [47.5, -100.5],
  OH: [40.3, -82.8], OK: [35.6, -97.5], OR: [44.0, -120.6], PA: [40.9, -77.7], RI: [41.7, -71.5],
  SC: [33.9, -80.9], SD: [44.5, -100.2], TN: [35.9, -86.3], TX: [31.5, -99.3], UT: [39.4, -111.6],
  VT: [44.0, -72.7], VA: [37.5, -78.8], WA: [47.4, -120.5], WV: [38.6, -80.6], WI: [44.6, -89.9],
  WY: [43.0, -107.5],
};

// Real city coordinates, keyed "City|ST" (state kept in the key so
// same-named cities in different states — Richmond VA vs. Richmond KY,
// Portland OR vs. Portland ME — don't collide). Covers every city in
// cities.ts's CITIES_BY_STATE plus the real college towns used in
// data/teamCities.ts's D1 school-to-city mapping.
export const CITY_COORDS: Record<string, [number, number]> = {
  "Birmingham|AL": [33.5, -86.8], "Montgomery|AL": [32.4, -86.3], "Huntsville|AL": [34.7, -86.6],
  "Mobile|AL": [30.7, -88.0], "Tuscaloosa|AL": [33.2, -87.6], "Hoover|AL": [33.4, -86.8],
  "Dothan|AL": [31.2, -85.4], "Auburn|AL": [32.6, -85.5], "Decatur|AL": [34.6, -87.0], "Selma|AL": [32.4, -87.0],
  "Jacksonville|AL": [33.82, -85.76], "Florence|AL": [34.8, -87.68], "Troy|AL": [31.81, -85.97], "Homewood|AL": [33.47, -86.8],

  "Anchorage|AK": [61.2, -149.9], "Fairbanks|AK": [64.8, -147.7], "Juneau|AK": [58.3, -134.4],
  "Sitka|AK": [57.1, -135.3], "Wasilla|AK": [61.6, -149.4], "Kenai|AK": [60.6, -151.3],
  "Kodiak|AK": [57.8, -152.4], "Palmer|AK": [61.6, -149.1],

  "Phoenix|AZ": [33.4, -112.1], "Tucson|AZ": [32.2, -110.9], "Mesa|AZ": [33.4, -111.8],
  "Chandler|AZ": [33.3, -111.8], "Scottsdale|AZ": [33.5, -111.9], "Glendale|AZ": [33.5, -112.2],
  "Tempe|AZ": [33.4, -111.9], "Peoria|AZ": [33.6, -112.2], "Flagstaff|AZ": [35.2, -111.7], "Yuma|AZ": [32.7, -114.6],

  "Little Rock|AR": [34.7, -92.3], "Fayetteville|AR": [36.1, -94.2], "Fort Smith|AR": [35.4, -94.4],
  "Springdale|AR": [36.2, -94.1], "Jonesboro|AR": [35.8, -90.7], "North Little Rock|AR": [34.8, -92.3],
  "Conway|AR": [35.1, -92.4], "Pine Bluff|AR": [34.2, -92.0],

  "Los Angeles|CA": [34.05, -118.24], "Compton|CA": [33.9, -118.2], "Long Beach|CA": [33.77, -118.19],
  "Sacramento|CA": [38.58, -121.49], "Oakland|CA": [37.8, -122.27], "San Diego|CA": [32.72, -117.16],
  "Fresno|CA": [36.75, -119.77], "Chino Hills|CA": [33.99, -117.73], "Riverside|CA": [33.95, -117.4],
  "Bakersfield|CA": [35.37, -119.02], "Inglewood|CA": [33.96, -118.35], "San Bernardino|CA": [34.11, -117.29],
  "Stockton|CA": [37.96, -121.29], "Anaheim|CA": [33.84, -117.91], "Santa Ana|CA": [33.75, -117.87],
  "Modesto|CA": [37.64, -120.99], "Fontana|CA": [34.09, -117.44], "Oxnard|CA": [34.2, -119.18],
  "Moreno Valley|CA": [33.94, -117.23], "Vallejo|CA": [38.1, -122.26], "Berkeley|CA": [37.87, -122.27],
  "Stanford|CA": [37.43, -122.17], "San Jose|CA": [37.34, -121.89], "Davis|CA": [38.54, -121.74],
  "San Luis Obispo|CA": [35.28, -120.66], "Fullerton|CA": [33.87, -117.93], "Northridge|CA": [34.24, -118.53],
  "Irvine|CA": [33.68, -117.83], "Santa Barbara|CA": [34.42, -119.7], "Malibu|CA": [34.04, -118.68],
  "Moraga|CA": [37.84, -122.13], "Santa Clara|CA": [37.35, -121.95], "San Francisco|CA": [37.77, -122.42],

  "Denver|CO": [39.74, -104.99], "Colorado Springs|CO": [38.83, -104.82], "Aurora|CO": [39.73, -104.83],
  "Fort Collins|CO": [40.59, -105.08], "Boulder|CO": [40.01, -105.27], "Pueblo|CO": [38.25, -104.6],
  "Greeley|CO": [40.42, -104.7], "Lakewood|CO": [39.7, -105.08],

  "Hartford|CT": [41.76, -72.69], "Bridgeport|CT": [41.18, -73.19], "New Haven|CT": [41.31, -72.93],
  "Stamford|CT": [41.05, -73.54], "Waterbury|CT": [41.56, -73.04], "Norwalk|CT": [41.12, -73.41],
  "Danbury|CT": [41.39, -73.45], "New London|CT": [41.36, -72.1], "Storrs|CT": [41.81, -72.25],
  "Fairfield|CT": [41.14, -73.26], "Hamden|CT": [41.4, -72.9], "New Britain|CT": [41.66, -72.78],
  "West Haven|CT": [41.27, -72.95], "Quinnipiac|CT": [41.4, -72.9],

  "Wilmington|DE": [39.75, -75.55], "Dover|DE": [39.16, -75.52], "Newark|DE": [39.68, -75.75],
  "Middletown|DE": [39.45, -75.72], "Smyrna|DE": [39.3, -75.6], "Milford|DE": [38.91, -75.43],

  "Washington|DC": [38.9, -77.04],

  "Miami|FL": [25.76, -80.19], "Orlando|FL": [28.54, -81.38], "Tampa|FL": [27.95, -82.46],
  "Jacksonville|FL": [30.33, -81.66], "Fort Lauderdale|FL": [26.12, -80.14], "St. Petersburg|FL": [27.77, -82.64],
  "Tallahassee|FL": [30.44, -84.28], "Hialeah|FL": [25.86, -80.28], "Pembroke Pines|FL": [26.02, -80.22],
  "West Palm Beach|FL": [26.71, -80.05], "Gainesville|FL": [29.65, -82.32], "Pensacola|FL": [30.42, -87.22],
  "Sarasota|FL": [27.34, -82.53], "Daytona Beach|FL": [29.21, -81.02], "Fort Myers|FL": [26.64, -81.87],
  "Coral Gables|FL": [25.72, -80.27], "Boca Raton|FL": [26.35, -80.08], "DeLand|FL": [29.03, -81.3],

  "Atlanta|GA": [33.75, -84.39], "Augusta|GA": [33.47, -81.97], "Savannah|GA": [32.08, -81.09],
  "Columbus|GA": [32.46, -84.99], "Macon|GA": [32.84, -83.63], "Marietta|GA": [33.95, -84.55],
  "Albany|GA": [31.58, -84.16], "Roswell|GA": [34.02, -84.36], "Decatur|GA": [33.77, -84.3],
  "Stone Mountain|GA": [33.81, -84.17], "Valdosta|GA": [30.83, -83.28], "Athens|GA": [33.96, -83.38],
  "Kennesaw|GA": [34.02, -84.62], "Statesboro|GA": [32.45, -81.78], "Carrollton|GA": [33.58, -85.08],

  "Honolulu|HI": [21.31, -157.86], "Hilo|HI": [19.71, -155.09], "Kailua|HI": [21.4, -157.74],
  "Kaneohe|HI": [21.42, -157.8], "Waipahu|HI": [21.39, -158.01], "Pearl City|HI": [21.4, -157.97],

  "Boise|ID": [43.62, -116.2], "Nampa|ID": [43.58, -116.56], "Meridian|ID": [43.61, -116.39],
  "Idaho Falls|ID": [43.49, -112.03], "Pocatello|ID": [42.87, -112.45], "Twin Falls|ID": [42.56, -114.46],
  "Coeur d'Alene|ID": [47.68, -116.78], "Moscow|ID": [46.73, -117.0],

  "Chicago|IL": [41.88, -87.63], "Aurora|IL": [41.76, -88.32], "Rockford|IL": [42.27, -89.09],
  "Joliet|IL": [41.53, -88.08], "Naperville|IL": [41.79, -88.15], "Peoria|IL": [40.69, -89.59],
  "Springfield|IL": [39.78, -89.65], "Elgin|IL": [42.04, -88.28], "Waukegan|IL": [42.36, -87.84],
  "Cicero|IL": [41.85, -87.75], "Champaign|IL": [40.12, -88.24], "Decatur|IL": [39.84, -88.95],
  "Evanston|IL": [42.05, -87.68], "Normal|IL": [40.51, -88.99], "Carbondale|IL": [37.73, -89.22],
  "DeKalb|IL": [41.93, -88.75], "Charleston|IL": [39.5, -88.18], "Edwardsville|IL": [38.81, -89.96],
  "Macomb|IL": [40.46, -90.67],

  "Indianapolis|IN": [39.77, -86.16], "Fort Wayne|IN": [41.08, -85.14], "Evansville|IN": [37.97, -87.56],
  "South Bend|IN": [41.68, -86.25], "Gary|IN": [41.59, -87.35], "Muncie|IN": [40.19, -85.39],
  "Terre Haute|IN": [39.47, -87.41], "Bloomington|IN": [39.17, -86.53], "Hammond|IN": [41.58, -87.5],
  "Notre Dame|IN": [41.7, -86.24], "West Lafayette|IN": [40.43, -86.91], "Valparaiso|IN": [41.47, -87.06],

  "Des Moines|IA": [41.6, -93.61], "Cedar Rapids|IA": [41.98, -91.67], "Davenport|IA": [41.52, -90.58],
  "Sioux City|IA": [42.5, -96.4], "Waterloo|IA": [42.5, -92.34], "Iowa City|IA": [41.66, -91.53],
  "Ames|IA": [42.03, -93.62], "Dubuque|IA": [42.5, -90.66], "Cedar Falls|IA": [42.53, -92.45],

  "Wichita|KS": [37.69, -97.34], "Overland Park|KS": [38.98, -94.67], "Kansas City|KS": [39.11, -94.63],
  "Topeka|KS": [39.05, -95.68], "Olathe|KS": [38.88, -94.82], "Lawrence|KS": [38.97, -95.24],
  "Salina|KS": [38.84, -97.61], "Manhattan|KS": [39.18, -96.57],

  "Louisville|KY": [38.25, -85.76], "Lexington|KY": [38.04, -84.5], "Bowling Green|KY": [36.99, -86.44],
  "Owensboro|KY": [37.77, -87.11], "Covington|KY": [39.08, -84.51], "Richmond|KY": [37.75, -84.29],
  "Paducah|KY": [37.08, -88.6], "Murray|KY": [36.61, -88.31], "Highland Heights|KY": [39.03, -84.45],
  "Morehead|KY": [38.18, -83.43],

  "New Orleans|LA": [29.95, -90.07], "Baton Rouge|LA": [30.45, -91.15], "Shreveport|LA": [32.53, -93.75],
  "Lafayette|LA": [30.22, -92.02], "Lake Charles|LA": [30.23, -93.22], "Monroe|LA": [32.51, -92.12],
  "Alexandria|LA": [31.31, -92.44], "Kenner|LA": [29.99, -90.24], "Ruston|LA": [32.53, -92.64],
  "Thibodaux|LA": [29.8, -90.82], "Natchitoches|LA": [31.76, -93.09], "Hammond|LA": [30.5, -90.46],
  "Grambling|LA": [32.53, -92.71],

  "Portland|ME": [43.66, -70.26], "Lewiston|ME": [44.1, -70.21], "Bangor|ME": [44.8, -68.77],
  "Auburn|ME": [44.1, -70.23], "South Portland|ME": [43.64, -70.24], "Augusta|ME": [44.31, -69.78],
  "Orono|ME": [44.88, -68.67],

  "Baltimore|MD": [39.29, -76.61], "Silver Spring|MD": [38.99, -77.03], "Frederick|MD": [39.41, -77.41],
  "Rockville|MD": [39.08, -77.15], "Annapolis|MD": [38.98, -76.49], "Bowie|MD": [39.0, -76.77],
  "Hagerstown|MD": [39.64, -77.72], "Salisbury|MD": [38.37, -75.6], "Gaithersburg|MD": [39.14, -77.2],
  "College Park|MD": [38.98, -76.94], "Towson|MD": [39.4, -76.6], "Princess Anne|MD": [38.2, -75.68],
  "Emmitsburg|MD": [39.7, -77.32],

  "Boston|MA": [42.36, -71.06], "Worcester|MA": [42.26, -71.8], "Springfield|MA": [42.1, -72.59],
  "Cambridge|MA": [42.37, -71.11], "Lowell|MA": [42.63, -71.32], "Brockton|MA": [42.08, -71.02],
  "New Bedford|MA": [41.64, -70.93], "Lynn|MA": [42.47, -70.95], "Quincy|MA": [42.25, -71.0],
  "Chestnut Hill|MA": [42.34, -71.17], "North Andover|MA": [42.7, -71.13], "Easton|MA": [42.03, -71.13],
  "Amherst|MA": [42.37, -72.52],

  "Detroit|MI": [42.33, -83.05], "Grand Rapids|MI": [42.96, -85.67], "Flint|MI": [43.01, -83.69],
  "Ann Arbor|MI": [42.28, -83.74], "Lansing|MI": [42.73, -84.56], "Saginaw|MI": [43.42, -83.95],
  "Pontiac|MI": [42.64, -83.29], "Southfield|MI": [42.47, -83.22], "Dearborn|MI": [42.32, -83.18],
  "Kalamazoo|MI": [42.29, -85.59], "Benton Harbor|MI": [42.12, -86.45], "East Lansing|MI": [42.74, -84.48],
  "Mount Pleasant|MI": [43.6, -84.77], "Ypsilanti|MI": [42.24, -83.61], "Rochester|MI": [42.68, -83.13],

  "Minneapolis|MN": [44.98, -93.27], "Saint Paul|MN": [44.95, -93.09], "Rochester|MN": [44.02, -92.47],
  "Duluth|MN": [46.79, -92.1], "Bloomington|MN": [44.83, -93.31], "Brooklyn Park|MN": [45.09, -93.36],
  "St. Cloud|MN": [45.56, -94.16], "Mankato|MN": [44.16, -93.99],

  "Jackson|MS": [32.3, -90.18], "Gulfport|MS": [30.37, -89.09], "Southaven|MS": [34.99, -90.03],
  "Hattiesburg|MS": [31.33, -89.29], "Biloxi|MS": [30.4, -88.89], "Meridian|MS": [32.36, -88.7],
  "Tupelo|MS": [34.26, -88.7], "Greenville|MS": [33.4, -91.06], "Oxford|MS": [34.37, -89.52],
  "Starkville|MS": [33.45, -88.82], "Lorman|MS": [31.85, -91.15], "Itta Bena|MS": [33.5, -90.33],

  "Kansas City|MO": [39.1, -94.58], "St. Louis|MO": [38.63, -90.2], "Springfield|MO": [37.21, -93.29],
  "Columbia|MO": [38.95, -92.33], "Independence|MO": [39.09, -94.42], "Lee's Summit|MO": [38.91, -94.38],
  "St. Joseph|MO": [39.77, -94.85], "Florissant|MO": [38.79, -90.32], "St. Charles|MO": [38.78, -90.48],
  "Cape Girardeau|MO": [37.3, -89.52],

  "Billings|MT": [45.78, -108.5], "Missoula|MT": [46.87, -114.0], "Great Falls|MT": [47.5, -111.3],
  "Bozeman|MT": [45.68, -111.04], "Helena|MT": [46.59, -112.04], "Kalispell|MT": [48.2, -114.31],

  "Omaha|NE": [41.26, -95.94], "Lincoln|NE": [40.81, -96.68], "Bellevue|NE": [41.14, -95.91],
  "Grand Island|NE": [40.92, -98.34], "Kearney|NE": [40.7, -99.08], "North Platte|NE": [41.12, -100.77],

  "Las Vegas|NV": [36.17, -115.14], "Henderson|NV": [36.03, -114.98], "Reno|NV": [39.53, -119.81],
  "North Las Vegas|NV": [36.2, -115.12], "Sparks|NV": [39.54, -119.75], "Carson City|NV": [39.16, -119.77],

  "Manchester|NH": [42.99, -71.46], "Nashua|NH": [42.77, -71.47], "Concord|NH": [43.21, -71.54],
  "Dover|NH": [43.2, -70.87], "Rochester|NH": [43.3, -70.98], "Portsmouth|NH": [43.07, -70.76],
  "Durham|NH": [43.13, -70.93], "Hanover|NH": [43.7, -72.29],

  "Newark|NJ": [40.74, -74.17], "Jersey City|NJ": [40.72, -74.08], "Paterson|NJ": [40.92, -74.17],
  "Elizabeth|NJ": [40.66, -74.21], "Trenton|NJ": [40.22, -74.76], "Camden|NJ": [39.93, -75.12],
  "Passaic|NJ": [40.86, -74.13], "Union City|NJ": [40.77, -74.02], "East Orange|NJ": [40.77, -74.21],
  "Atlantic City|NJ": [39.36, -74.42], "New Brunswick|NJ": [40.5, -74.45], "Piscataway|NJ": [40.5, -74.46],
  "South Orange|NJ": [40.75, -74.26], "Princeton|NJ": [40.35, -74.66], "West Long Branch|NJ": [40.29, -74.0],
  "Lawrenceville|NJ": [40.3, -74.73], "Teaneck|NJ": [40.9, -74.02],

  "Albuquerque|NM": [35.08, -106.65], "Las Cruces|NM": [32.32, -106.78], "Santa Fe|NM": [35.69, -105.94],
  "Rio Rancho|NM": [35.23, -106.66], "Roswell|NM": [33.39, -104.52], "Farmington|NM": [36.73, -108.21],

  "New York City|NY": [40.71, -74.01], "Brooklyn|NY": [40.68, -73.94], "Queens|NY": [40.73, -73.79],
  "The Bronx|NY": [40.84, -73.87], "Buffalo|NY": [42.89, -78.88], "Rochester|NY": [43.16, -77.61],
  "Yonkers|NY": [40.94, -73.9], "Syracuse|NY": [43.05, -76.15], "Albany|NY": [42.65, -73.75],
  "Mount Vernon|NY": [40.91, -73.84], "Schenectady|NY": [42.81, -73.94], "Utica|NY": [43.1, -75.23],
  "New Rochelle|NY": [40.91, -73.78], "Olean|NY": [42.08, -78.43], "Ithaca|NY": [42.44, -76.5],
  "Binghamton|NY": [42.1, -75.91], "Hempstead|NY": [40.71, -73.62], "Stony Brook|NY": [40.91, -73.14],
  "Riverdale|NY": [40.9, -73.9], "Poughkeepsie|NY": [41.7, -73.93], "Lewiston|NY": [43.17, -79.04],
  "Loudonville|NY": [42.7, -73.75], "Staten Island|NY": [40.58, -74.15], "West Point|NY": [41.39, -73.96],
  "Hamilton|NY": [42.82, -75.54],

  "Charlotte|NC": [35.23, -80.84], "Raleigh|NC": [35.78, -78.64], "Greensboro|NC": [36.07, -79.79],
  "Durham|NC": [35.99, -78.9], "Winston-Salem|NC": [36.1, -80.24], "Fayetteville|NC": [35.05, -78.88],
  "Cary|NC": [35.79, -78.78], "High Point|NC": [35.97, -80.0], "Wilmington|NC": [34.23, -77.94],
  "Asheville|NC": [35.6, -82.55], "Gastonia|NC": [35.26, -81.19], "Chapel Hill|NC": [35.91, -79.06],
  "Greenville|NC": [35.61, -77.37],
  "Davidson|NC": [35.5, -80.85], "Boone|NC": [36.22, -81.67], "Buies Creek|NC": [35.41, -78.75],
  "Elon|NC": [36.1, -79.51], "Cullowhee|NC": [35.31, -83.18],

  "Fargo|ND": [46.88, -96.79], "Bismarck|ND": [46.81, -100.78], "Grand Forks|ND": [47.93, -97.03],
  "Minot|ND": [48.23, -101.3], "West Fargo|ND": [46.88, -96.9],

  "Columbus|OH": [39.96, -83.0], "Cleveland|OH": [41.5, -81.69], "Cincinnati|OH": [39.1, -84.51],
  "Toledo|OH": [41.66, -83.56], "Akron|OH": [41.08, -81.52], "Dayton|OH": [39.76, -84.19],
  "Youngstown|OH": [41.1, -80.65], "Canton|OH": [40.8, -81.38], "Lorain|OH": [41.45, -82.18],
  "Springfield|OH": [39.92, -83.81], "Kettering|OH": [39.69, -84.17], "Kent|OH": [41.15, -81.36],
  "Oxford|OH": [39.51, -84.74], "Athens|OH": [39.33, -82.1], "Bowling Green|OH": [41.38, -83.65],

  "Oklahoma City|OK": [35.47, -97.52], "Tulsa|OK": [36.15, -95.99], "Norman|OK": [35.22, -97.44],
  "Broken Arrow|OK": [36.05, -95.8], "Lawton|OK": [34.61, -98.4], "Edmond|OK": [35.65, -97.48],
  "Moore|OK": [35.34, -97.49], "Stillwater|OK": [36.12, -97.06],

  "Portland|OR": [45.52, -122.68], "Eugene|OR": [44.05, -123.09], "Salem|OR": [44.94, -123.04],
  "Gresham|OR": [45.5, -122.43], "Hillsboro|OR": [45.52, -122.99], "Bend|OR": [44.06, -121.31],
  "Beaverton|OR": [45.49, -122.8], "Medford|OR": [42.33, -122.87], "Corvallis|OR": [44.56, -123.26],

  "Philadelphia|PA": [39.95, -75.16], "Pittsburgh|PA": [40.44, -79.99], "Allentown|PA": [40.6, -75.47],
  "Erie|PA": [42.13, -80.08], "Reading|PA": [40.34, -75.93], "Scranton|PA": [41.41, -75.66],
  "Bethlehem|PA": [40.63, -75.37], "Lancaster|PA": [40.04, -76.31], "Harrisburg|PA": [40.27, -76.88],
  "Chester|PA": [39.85, -75.36], "Wilkes-Barre|PA": [41.25, -75.88], "Villanova|PA": [40.04, -75.34],
  "University Park|PA": [40.8, -77.86], "Moon Township|PA": [40.51, -80.2], "Loretto|PA": [40.5, -78.63],
  "Lewisburg|PA": [40.97, -76.88], "Easton|PA": [40.69, -75.22],

  "Providence|RI": [41.82, -71.41], "Cranston|RI": [41.78, -71.44], "Warwick|RI": [41.7, -71.42],
  "Pawtucket|RI": [41.88, -71.38], "Woonsocket|RI": [42.0, -71.51], "Newport|RI": [41.49, -71.31],
  "Kingston|RI": [41.48, -71.53], "Smithfield|RI": [41.92, -71.54],

  "Columbia|SC": [34.0, -81.03], "Charleston|SC": [32.78, -79.93], "North Charleston|SC": [32.85, -79.98],
  "Greenville|SC": [34.85, -82.4], "Rock Hill|SC": [34.92, -81.02], "Mount Pleasant|SC": [32.82, -79.86],
  "Spartanburg|SC": [34.95, -81.93], "Sumter|SC": [33.92, -80.34], "Clemson|SC": [34.68, -82.84],
  "Conway|SC": [33.84, -79.05], "Orangeburg|SC": [33.49, -80.86],

  "Sioux Falls|SD": [43.55, -96.73], "Rapid City|SD": [44.08, -103.23], "Aberdeen|SD": [45.46, -98.49],
  "Brookings|SD": [44.31, -96.8], "Watertown|SD": [44.9, -97.12], "Vermillion|SD": [42.78, -96.93],

  "Memphis|TN": [35.15, -90.05], "Nashville|TN": [36.16, -86.78], "Knoxville|TN": [35.96, -83.92],
  "Chattanooga|TN": [35.05, -85.31], "Clarksville|TN": [36.53, -87.36], "Murfreesboro|TN": [35.85, -86.39],
  "Jackson|TN": [35.61, -88.81], "Franklin|TN": [35.93, -86.87], "Johnson City|TN": [36.31, -82.35],
  "Martin|TN": [36.34, -88.85], "Cookeville|TN": [36.16, -85.5],

  "Houston|TX": [29.76, -95.37], "Dallas|TX": [32.78, -96.8], "San Antonio|TX": [29.42, -98.49],
  "Austin|TX": [30.27, -97.74], "Fort Worth|TX": [32.75, -97.33], "El Paso|TX": [31.76, -106.49],
  "Arlington|TX": [32.74, -97.11], "Corpus Christi|TX": [27.8, -97.4], "Plano|TX": [33.02, -96.7],
  "Garland|TX": [32.91, -96.64], "Irving|TX": [32.81, -96.95], "Lubbock|TX": [33.58, -101.85],
  "Amarillo|TX": [35.2, -101.83], "Waco|TX": [31.55, -97.15], "Beaumont|TX": [30.08, -94.13],
  "Killeen|TX": [31.12, -97.73], "College Station|TX": [30.63, -96.33], "Denton|TX": [33.21, -97.13],
  "San Marcos|TX": [29.88, -97.94], "Abilene|TX": [32.45, -99.73], "Stephenville|TX": [32.22, -98.21],
  "Huntsville|TX": [30.72, -95.55], "Commerce|TX": [33.25, -95.9], "Nacogdoches|TX": [31.6, -94.66],
  "Edinburg|TX": [26.3, -98.16], "Prairie View|TX": [30.09, -95.99],

  "Salt Lake City|UT": [40.76, -111.89], "West Valley City|UT": [40.69, -112.0], "Provo|UT": [40.23, -111.66],
  "West Jordan|UT": [40.6, -111.94], "Orem|UT": [40.3, -111.7], "Ogden|UT": [41.22, -111.97],
  "Sandy|UT": [40.57, -111.86], "St. George|UT": [37.1, -113.58], "Logan|UT": [41.74, -111.83],
  "Cedar City|UT": [37.68, -113.06],

  "Burlington|VT": [44.48, -73.21], "South Burlington|VT": [44.47, -73.17], "Rutland|VT": [43.61, -72.97],
  "Montpelier|VT": [44.26, -72.58], "Barre|VT": [44.2, -72.5],

  "Virginia Beach|VA": [36.85, -75.98], "Norfolk|VA": [36.85, -76.29], "Richmond|VA": [37.54, -77.44],
  "Chesapeake|VA": [36.77, -76.29], "Arlington|VA": [38.88, -77.1], "Newport News|VA": [37.09, -76.47],
  "Alexandria|VA": [38.8, -77.05], "Hampton|VA": [37.03, -76.35], "Roanoke|VA": [37.27, -79.94],
  "Portsmouth|VA": [36.84, -76.3], "Suffolk|VA": [36.73, -76.58], "Lynchburg|VA": [37.41, -79.14],
  "Blacksburg|VA": [37.23, -80.41], "Charlottesville|VA": [38.03, -78.48], "Fairfax|VA": [38.85, -77.31],
  "Harrisonburg|VA": [38.45, -78.87], "Williamsburg|VA": [37.27, -76.71], "Lexington|VA": [37.78, -79.44],

  "Seattle|WA": [47.61, -122.33], "Spokane|WA": [47.66, -117.43], "Tacoma|WA": [47.25, -122.44],
  "Vancouver|WA": [45.63, -122.66], "Bellevue|WA": [47.61, -122.2], "Everett|WA": [47.98, -122.2],
  "Federal Way|WA": [47.32, -122.31], "Renton|WA": [47.48, -122.21], "Yakima|WA": [46.6, -120.51],
  "Pullman|WA": [46.73, -117.18], "Cheney|WA": [47.49, -117.58],

  "Charleston|WV": [38.35, -81.63], "Huntington|WV": [38.42, -82.44], "Morgantown|WV": [39.63, -79.96],
  "Parkersburg|WV": [39.27, -81.56], "Wheeling|WV": [40.06, -80.72],

  "Milwaukee|WI": [43.04, -87.91], "Madison|WI": [43.07, -89.4], "Green Bay|WI": [44.51, -88.02],
  "Kenosha|WI": [42.58, -87.82], "Racine|WI": [42.73, -87.78], "Appleton|WI": [44.26, -88.42],
  "Waukesha|WI": [43.01, -88.23], "Oshkosh|WI": [44.02, -88.54],

  "Cheyenne|WY": [41.14, -104.82], "Casper|WY": [42.85, -106.31], "Laramie|WY": [41.31, -105.59],
  "Gillette|WY": [44.29, -105.5], "Rock Springs|WY": [41.59, -109.2],
};

// Deterministic 0-1 hash of a string, used to jitter a fallback coordinate so
// two different unlisted cities in the same state don't land on the exact
// same point.
function hashUnit(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// Best-effort coordinate for a city/state pair. Falls back to the state's
// centroid with a small deterministic jitter when the specific city isn't in
// CITY_COORDS (e.g. a smaller D2/D3 town), so distance comparisons still make
// sense without ever placing someone outside their actual state.
export function cityCoordinate(city: string, state: string): [number, number] | null {
  const exact = CITY_COORDS[`${city}|${state}`];
  if (exact) return exact;
  const centroid = STATE_CENTROIDS[state];
  if (!centroid) return null;
  if (!city) return centroid;
  const jitterLat = (hashUnit(city) - 0.5) * 1.2;
  const jitterLon = (hashUnit(city + "|lon") - 0.5) * 1.2;
  return [centroid[0] + jitterLat, centroid[1] + jitterLon];
}

// Picks a real host city for a school. D1 schools use the curated
// data/teamCities.ts mapping (real city); everything else (D2/D3/JUCO, and
// any D1 school that somehow isn't in the mapping) falls back to a random
// pick from cities.ts's CITIES_BY_STATE, same as how players' hometownCity
// is generated — there's no per-school source list for the ~3,600 D2/D3
// schools to draw a real city from.
export function pickTeamCity(
  rng: () => number, schoolName: string, state: string,
  d1TeamCities: Record<string, string>, citiesByState: Record<string, string[]>,
): string {
  const real = d1TeamCities[schoolName];
  if (real) return real;
  const options = citiesByState[state];
  if (!options || options.length === 0) return "";
  return options[Math.floor(rng() * options.length)];
}

// Great-circle distance in miles between two [lat, lon] points.
export function haversineMiles(a: [number, number], b: [number, number]): number {
  const R = 3958.8;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
