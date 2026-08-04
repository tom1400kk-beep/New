// Real host city for every D1 school in d1_conferences.json, keyed by the
// exact "school" string used there. D2/D3/JUCO have no per-school city data
// available (thousands of schools with no source list to draw from), so
// those divisions fall back to a deterministic pick from cities.ts's
// CITIES_BY_STATE instead — see pickTeamCity() in engine/geo.ts's caller,
// createSaveWorld.ts.
export const D1_TEAM_CITIES: Record<string, string> = {
  "Boston College": "Chestnut Hill", "California": "Berkeley", "Clemson": "Clemson", "Duke": "Durham",
  "Florida State": "Tallahassee", "Georgia Tech": "Atlanta", "Louisville": "Louisville", "Miami (FL)": "Coral Gables",
  "NC State": "Raleigh", "North Carolina": "Chapel Hill", "Notre Dame": "Notre Dame", "Pittsburgh": "Pittsburgh",
  "SMU": "Dallas", "Stanford": "Stanford", "Syracuse": "Syracuse", "Virginia": "Charlottesville",
  "Virginia Tech": "Blacksburg", "Wake Forest": "Winston-Salem",

  "Illinois": "Champaign", "Indiana": "Bloomington", "Iowa": "Iowa City", "Maryland": "College Park",
  "Michigan": "Ann Arbor", "Michigan State": "East Lansing", "Minnesota": "Minneapolis", "Nebraska": "Lincoln",
  "Northwestern": "Evanston", "Ohio State": "Columbus", "Oregon": "Eugene", "Penn State": "University Park",
  "Purdue": "West Lafayette", "Rutgers": "Piscataway", "UCLA": "Los Angeles", "USC": "Los Angeles",
  "Washington": "Seattle", "Wisconsin": "Madison",

  "Arizona": "Tucson", "Arizona State": "Tempe", "Baylor": "Waco", "BYU": "Provo", "UCF": "Orlando",
  "Cincinnati": "Cincinnati", "Colorado": "Boulder", "Houston": "Houston", "Iowa State": "Ames",
  "Kansas": "Lawrence", "Kansas State": "Manhattan", "Oklahoma State": "Stillwater", "TCU": "Fort Worth",
  "Texas Tech": "Lubbock", "Utah": "Salt Lake City", "West Virginia": "Morgantown",

  "Alabama": "Tuscaloosa", "Arkansas": "Fayetteville", "Auburn": "Auburn", "Florida": "Gainesville",
  "Georgia": "Athens", "Kentucky": "Lexington", "LSU": "Baton Rouge", "Ole Miss": "Oxford",
  "Mississippi State": "Starkville", "Missouri": "Columbia", "Oklahoma": "Norman", "South Carolina": "Columbia",
  "Tennessee": "Knoxville", "Texas": "Austin", "Texas A&M": "College Station", "Vanderbilt": "Nashville",

  "Butler": "Indianapolis", "Creighton": "Omaha", "DePaul": "Chicago", "Georgetown": "Washington",
  "Marquette": "Milwaukee", "Providence": "Providence", "Seton Hall": "South Orange", "St. John's": "Queens",
  "UConn": "Storrs", "Villanova": "Villanova", "Xavier": "Cincinnati",

  "Charlotte": "Charlotte", "East Carolina": "Greenville", "Florida Atlantic": "Boca Raton", "Memphis": "Memphis",
  "North Texas": "Denton", "Rice": "Houston", "South Florida": "Tampa", "Temple": "Philadelphia",
  "Tulane": "New Orleans", "Tulsa": "Tulsa", "UAB": "Birmingham", "UTSA": "San Antonio", "Wichita State": "Wichita",

  "Davidson": "Davidson", "Dayton": "Dayton", "Duquesne": "Pittsburgh", "Fordham": "The Bronx",
  "George Mason": "Fairfax", "George Washington": "Washington", "La Salle": "Philadelphia",
  "Loyola Chicago": "Chicago", "Rhode Island": "Kingston", "Richmond": "Richmond", "Saint Joseph's": "Philadelphia",
  "Saint Louis": "St. Louis", "St. Bonaventure": "Olean", "VCU": "Richmond",

  "Air Force": "Colorado Springs", "Hawaii": "Honolulu", "New Mexico": "Albuquerque", "Nevada": "Reno",
  "San Jose State": "San Jose", "UNLV": "Las Vegas", "UTEP": "El Paso", "Wyoming": "Laramie",
  "Grand Canyon": "Phoenix", "UC Davis": "Davis",

  "Boise State": "Boise", "Colorado State": "Fort Collins", "Fresno State": "Fresno", "Gonzaga": "Spokane",
  "Oregon State": "Corvallis", "San Diego State": "San Diego", "Texas State": "San Marcos",
  "Utah State": "Logan", "Washington State": "Pullman",

  "Denver": "Denver", "Loyola Marymount": "Los Angeles", "Pacific": "Stockton", "Pepperdine": "Malibu",
  "Portland": "Portland", "Saint Mary's": "Moraga", "San Diego": "San Diego", "San Francisco": "San Francisco",
  "Santa Clara": "Santa Clara", "Seattle": "Seattle",

  "Belmont": "Nashville", "Bradley": "Peoria", "Drake": "Des Moines", "Evansville": "Evansville",
  "Illinois State": "Normal", "Indiana State": "Terre Haute", "Murray State": "Murray",
  "Northern Iowa": "Cedar Falls", "Southern Illinois": "Carbondale", "UIC": "Chicago", "Valparaiso": "Valparaiso",

  "Liberty": "Lynchburg", "Western Kentucky": "Bowling Green", "Middle Tennessee": "Murfreesboro",
  "Kennesaw State": "Kennesaw", "Jacksonville State": "Jacksonville", "FIU": "Miami", "Sam Houston": "Huntsville",
  "New Mexico State": "Las Cruces", "Delaware": "Newark", "Missouri State": "Springfield",

  "Appalachian State": "Boone", "Arkansas State": "Jonesboro", "Coastal Carolina": "Conway",
  "Georgia Southern": "Statesboro", "Georgia State": "Atlanta", "James Madison": "Harrisonburg",
  "Louisiana": "Lafayette", "Louisiana Tech": "Ruston", "Marshall": "Huntington", "Old Dominion": "Norfolk",
  "South Alabama": "Mobile", "Southern Miss": "Hattiesburg", "Troy": "Troy", "Louisiana-Monroe": "Monroe",

  "Albany": "Albany", "Binghamton": "Binghamton", "Bryant": "Smithfield", "UMBC": "Baltimore",
  "UMass Lowell": "Lowell", "New Hampshire": "Durham", "NJIT": "Newark", "Maine": "Orono", "Vermont": "Burlington",

  "Bellarmine": "Louisville", "Florida Gulf Coast": "Fort Myers", "Jacksonville": "Jacksonville",
  "Lipscomb": "Nashville", "North Florida": "Jacksonville", "Queens": "Charlotte", "Stetson": "DeLand",

  "Abilene Christian": "Abilene", "Little Rock": "Little Rock", "Austin Peay": "Clarksville",
  "Central Arkansas": "Conway", "Eastern Kentucky": "Richmond", "North Alabama": "Florence",
  "Tarleton State": "Stephenville", "UT Arlington": "Arlington", "West Georgia": "Carrollton",

  "Montana": "Missoula", "Montana State": "Bozeman", "Eastern Washington": "Cheney", "Idaho": "Moscow",
  "Idaho State": "Pocatello", "Northern Arizona": "Flagstaff", "Northern Colorado": "Greeley",
  "Portland State": "Portland", "Weber State": "Ogden", "Southern Utah": "Cedar City", "Utah Tech": "St. George",

  "Cal Poly": "San Luis Obispo", "CSU Bakersfield": "Bakersfield", "Cal State Fullerton": "Fullerton",
  "Cal State Northridge": "Northridge", "Long Beach State": "Long Beach", "UC Irvine": "Irvine",
  "UC Riverside": "Riverside", "UC San Diego": "San Diego", "UC Santa Barbara": "Santa Barbara",
  "California Baptist": "Riverside", "Sacramento State": "Sacramento", "Utah Valley": "Orem",

  "Campbell": "Buies Creek", "Charleston": "Charleston", "Drexel": "Philadelphia", "Elon": "Elon",
  "Hampton": "Hampton", "Hofstra": "Hempstead", "Monmouth": "West Long Branch",
  "North Carolina A&T": "Greensboro", "Northeastern": "Boston", "Stony Brook": "Stony Brook",
  "Towson": "Towson", "UNC Wilmington": "Wilmington", "William & Mary": "Williamsburg",

  "Cleveland State": "Cleveland", "Detroit Mercy": "Detroit", "Green Bay": "Green Bay", "IU Indy": "Indianapolis",
  "Milwaukee": "Milwaukee", "Northern Kentucky": "Highland Heights", "Oakland": "Rochester",
  "Purdue Fort Wayne": "Fort Wayne", "Robert Morris": "Moon Township", "Wright State": "Dayton",
  "Youngstown State": "Youngstown",

  "Brown": "Providence", "Columbia": "New York City", "Cornell": "Ithaca", "Dartmouth": "Hanover",
  "Harvard": "Cambridge", "Penn": "Philadelphia", "Princeton": "Princeton", "Yale": "New Haven",

  "Canisius": "Buffalo", "Fairfield": "Fairfield", "Iona": "New Rochelle", "Manhattan": "Riverdale",
  "Marist": "Poughkeepsie", "Merrimack": "North Andover", "Mount St. Mary's": "Emmitsburg",
  "Niagara": "Lewiston", "Quinnipiac": "Hamden", "Rider": "Lawrenceville", "Saint Peter's": "Jersey City",
  "Siena": "Loudonville",

  "Akron": "Akron", "Ball State": "Muncie", "Bowling Green": "Bowling Green", "Buffalo": "Buffalo",
  "Central Michigan": "Mount Pleasant", "Eastern Michigan": "Ypsilanti", "Kent State": "Kent",
  "Miami (OH)": "Oxford", "Northern Illinois": "DeKalb", "Ohio": "Athens", "Toledo": "Toledo",
  "UMass": "Amherst", "Western Michigan": "Kalamazoo",

  "Coppin State": "Baltimore", "Delaware State": "Dover", "Howard": "Washington",
  "Maryland-Eastern Shore": "Princess Anne", "Morgan State": "Baltimore", "Norfolk State": "Norfolk",
  "North Carolina Central": "Durham", "South Carolina State": "Orangeburg",

  "Fairleigh Dickinson": "Teaneck", "Long Island University": "Brooklyn", "Saint Francis (PA)": "Loretto",
  "Wagner": "Staten Island", "Central Connecticut": "New Britain", "Stonehill": "Easton",
  "Le Moyne": "Syracuse", "Chicago State": "Chicago", "Mercyhurst": "Erie", "New Haven": "West Haven",

  "Eastern Illinois": "Charleston", "Lindenwood": "St. Charles", "Morehead State": "Morehead",
  "Southeast Missouri State": "Cape Girardeau", "SIU Edwardsville": "Edwardsville",
  "Southern Indiana": "Evansville", "Tennessee State": "Nashville", "UT Martin": "Martin",
  "Western Illinois": "Macomb",

  "American": "Washington", "Army": "West Point", "Boston University": "Boston", "Bucknell": "Lewisburg",
  "Colgate": "Hamilton", "Holy Cross": "Worcester", "Lafayette": "Easton", "Lehigh": "Bethlehem",
  "Loyola Maryland": "Baltimore", "Navy": "Annapolis",

  "Chattanooga": "Chattanooga", "The Citadel": "Charleston", "East Tennessee State": "Johnson City",
  "Furman": "Greenville", "Mercer": "Macon", "UNC Greensboro": "Greensboro", "Samford": "Homewood",
  "VMI": "Lexington", "Western Carolina": "Cullowhee", "Wofford": "Spartanburg", "Tennessee Tech": "Cookeville",

  "Houston Christian": "Houston", "Incarnate Word": "San Antonio", "Lamar": "Beaumont",
  "McNeese": "Lake Charles", "New Orleans": "New Orleans", "Nicholls": "Thibodaux",
  "Northwestern State": "Natchitoches", "East Texas A&M": "Commerce",
  "Southeastern Louisiana": "Hammond", "Stephen F. Austin": "Nacogdoches",
  "Texas A&M-Corpus Christi": "Corpus Christi", "UT Rio Grande Valley": "Edinburg",

  "Alabama A&M": "Huntsville", "Alabama State": "Montgomery", "Alcorn State": "Lorman",
  "Arkansas-Pine Bluff": "Pine Bluff", "Bethune-Cookman": "Daytona Beach", "Florida A&M": "Tallahassee",
  "Grambling State": "Grambling", "Jackson State": "Jackson", "Mississippi Valley State": "Itta Bena",
  "Prairie View A&M": "Prairie View", "Southern": "Baton Rouge", "Texas Southern": "Houston",

  "North Dakota State": "Fargo", "North Dakota": "Grand Forks", "South Dakota State": "Brookings",
  "South Dakota": "Vermillion", "Kansas City": "Kansas City", "Omaha": "Omaha", "Oral Roberts": "Tulsa",
  "St. Thomas (MN)": "Saint Paul",
};
