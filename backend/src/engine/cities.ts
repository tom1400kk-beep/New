// Real US cities/towns per state, used to give generated players a specific,
// plausible hometown instead of just a state code. Mixes big basketball-hotbed
// metros with smaller towns so recruits from anywhere still feel grounded in
// a real place, not just a big city every time.
export const CITIES_BY_STATE: Record<string, string[]> = {
  AL: ["Birmingham", "Montgomery", "Huntsville", "Mobile", "Tuscaloosa", "Hoover", "Dothan", "Auburn", "Decatur", "Selma"],
  AK: ["Anchorage", "Fairbanks", "Juneau", "Sitka", "Wasilla", "Kenai", "Kodiak", "Palmer"],
  AZ: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale", "Tempe", "Peoria", "Flagstaff", "Yuma"],
  AR: ["Little Rock", "Fayetteville", "Fort Smith", "Springdale", "Jonesboro", "North Little Rock", "Conway", "Pine Bluff"],
  CA: [
    "Los Angeles", "Compton", "Long Beach", "Sacramento", "Oakland", "San Diego", "Fresno", "Chino Hills",
    "Riverside", "Bakersfield", "Inglewood", "San Bernardino", "Stockton", "Anaheim", "Santa Ana", "Modesto",
    "Fontana", "Oxnard", "Moreno Valley", "Vallejo",
  ],
  CO: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Boulder", "Pueblo", "Greeley", "Lakewood"],
  CT: ["Hartford", "Bridgeport", "New Haven", "Stamford", "Waterbury", "Norwalk", "Danbury", "New London"],
  DE: ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna", "Milford"],
  DC: ["Washington"],
  FL: [
    "Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale", "St. Petersburg", "Tallahassee", "Hialeah",
    "Pembroke Pines", "West Palm Beach", "Gainesville", "Pensacola", "Sarasota", "Daytona Beach", "Fort Myers",
  ],
  GA: [
    "Atlanta", "Augusta", "Savannah", "Columbus", "Macon", "Marietta", "Albany", "Roswell", "Decatur",
    "Stone Mountain", "Valdosta", "Athens",
  ],
  HI: ["Honolulu", "Hilo", "Kailua", "Kaneohe", "Waipahu", "Pearl City"],
  ID: ["Boise", "Nampa", "Meridian", "Idaho Falls", "Pocatello", "Twin Falls", "Coeur d'Alene"],
  IL: [
    "Chicago", "Aurora", "Rockford", "Joliet", "Naperville", "Peoria", "Springfield", "Elgin", "Waukegan",
    "Cicero", "Champaign", "Decatur",
  ],
  IN: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Gary", "Muncie", "Terre Haute", "Bloomington", "Hammond"],
  IA: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Waterloo", "Iowa City", "Ames", "Dubuque"],
  KS: ["Wichita", "Overland Park", "Kansas City", "Topeka", "Olathe", "Lawrence", "Salina", "Manhattan"],
  KY: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington", "Richmond", "Paducah"],
  LA: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles", "Monroe", "Alexandria", "Kenner"],
  ME: ["Portland", "Lewiston", "Bangor", "Auburn", "South Portland", "Augusta"],
  MD: ["Baltimore", "Silver Spring", "Frederick", "Rockville", "Annapolis", "Bowie", "Hagerstown", "Salisbury", "Gaithersburg"],
  MA: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Brockton", "New Bedford", "Lynn", "Quincy"],
  MI: [
    "Detroit", "Grand Rapids", "Flint", "Ann Arbor", "Lansing", "Saginaw", "Pontiac", "Southfield", "Dearborn",
    "Kalamazoo", "Benton Harbor",
  ],
  MN: ["Minneapolis", "Saint Paul", "Rochester", "Duluth", "Bloomington", "Brooklyn Park", "St. Cloud", "Mankato"],
  MS: ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi", "Meridian", "Tupelo", "Greenville"],
  MO: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence", "Lee's Summit", "St. Joseph", "Florissant"],
  MT: ["Billings", "Missoula", "Great Falls", "Bozeman", "Helena", "Kalispell"],
  NE: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney", "North Platte"],
  NV: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City"],
  NH: ["Manchester", "Nashua", "Concord", "Dover", "Rochester", "Portsmouth"],
  NJ: [
    "Newark", "Jersey City", "Paterson", "Elizabeth", "Trenton", "Camden", "Passaic", "Union City",
    "East Orange", "Atlantic City", "New Brunswick",
  ],
  NM: ["Albuquerque", "Las Cruces", "Santa Fe", "Rio Rancho", "Roswell", "Farmington"],
  NY: [
    "New York City", "Brooklyn", "Queens", "The Bronx", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany",
    "Mount Vernon", "Schenectady", "Utica", "New Rochelle",
  ],
  NC: [
    "Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary", "High Point",
    "Wilmington", "Asheville", "Gastonia",
  ],
  ND: ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo"],
  OH: [
    "Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Youngstown", "Canton", "Lorain",
    "Springfield", "Kettering",
  ],
  OK: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Lawton", "Edmond", "Moore"],
  OR: ["Portland", "Eugene", "Salem", "Gresham", "Hillsboro", "Bend", "Beaverton", "Medford"],
  PA: [
    "Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem", "Lancaster",
    "Harrisburg", "Chester", "Wilkes-Barre",
  ],
  RI: ["Providence", "Cranston", "Warwick", "Pawtucket", "Woonsocket", "Newport"],
  SC: ["Columbia", "Charleston", "North Charleston", "Greenville", "Rock Hill", "Mount Pleasant", "Spartanburg", "Sumter"],
  SD: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown"],
  TN: [
    "Memphis", "Nashville", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro", "Jackson", "Franklin",
  ],
  TX: [
    "Houston", "Dallas", "San Antonio", "Austin", "Fort Worth", "El Paso", "Arlington", "Corpus Christi",
    "Plano", "Garland", "Irving", "Lubbock", "Amarillo", "Waco", "Beaumont", "Killeen",
  ],
  UT: ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem", "Ogden", "Sandy", "St. George"],
  VT: ["Burlington", "South Burlington", "Rutland", "Montpelier", "Barre"],
  VA: [
    "Virginia Beach", "Norfolk", "Richmond", "Chesapeake", "Arlington", "Newport News", "Alexandria",
    "Hampton", "Roanoke", "Portsmouth", "Suffolk", "Lynchburg",
  ],
  WA: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Everett", "Federal Way", "Renton", "Yakima"],
  WV: ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling"],
  WI: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton", "Waukesha", "Oshkosh"],
  WY: ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs"],
};

export function pickCityForState(rng: () => number, state: string): string {
  const cities = CITIES_BY_STATE[state];
  if (!cities || cities.length === 0) return "";
  return cities[Math.floor(rng() * cities.length)];
}
