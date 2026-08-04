// A large, best-effort list of real, well-known US high schools per state —
// mostly large public schools in major cities/metro areas, plus a handful of
// well-known private/prep schools — used so the large majority of HS
// prospects/players get a genuine school name instead of a procedurally
// generated placeholder. Not exhaustive (there are ~24,000 public high
// schools in the US alone) and not verified against an official database;
// treat it the same as the rest of this game's real-world flavor data
// (real team/conference names, real cities) — accurate in spirit, not an
// audit of any specific roster or season. Keys match the 2-letter state
// codes used throughout engine/regions.ts and engine/cities.ts.
export const REAL_HIGH_SCHOOLS_BY_STATE: Record<string, string[]> = {
  AL: [
    "Vestavia Hills High School", "Hoover High School", "Mountain Brook High School", "Auburn High School",
    "Homewood High School", "Spain Park High School", "Hewitt-Trussville High School", "Thompson High School",
    "Bob Jones High School", "Huffman High School", "Central High School of Tuscaloosa", "Murphy High School",
    "Prattville High School", "Enterprise High School",
  ],
  AK: [
    "East Anchorage High School", "West Anchorage High School", "Dimond High School", "Service High School",
    "Juneau-Douglas High School", "West Valley High School", "Lathrop High School", "Chugiak High School",
    "Bartlett High School", "South Anchorage High School",
  ],
  AZ: [
    "Brophy College Preparatory", "Chaparral High School", "Desert Vista High School", "Mountain Pointe High School",
    "Corona del Sol High School", "Hamilton High School", "Xavier College Preparatory", "Perry High School",
    "Sandra Day O'Connor High School", "Cactus Shadows High School", "Saguaro High School", "Pinnacle High School",
    "Basha High School", "Red Mountain High School",
  ],
  AR: [
    "Little Rock Central High School", "Bentonville High School", "Fayetteville High School", "Conway High School",
    "Rogers High School", "Bryant High School", "Cabot High School", "North Little Rock High School",
    "Jonesboro High School", "Pulaski Academy",
  ],
  CA: [
    "Long Beach Poly High School", "Mater Dei High School", "Fairfax High School", "Beverly Hills High School",
    "Venice High School", "Crenshaw High School", "Dorsey High School", "Compton High School", "Inglewood High School",
    "Fremont High School", "Narbonne High School", "Gardena High School", "Redondo Union High School",
    "Palisades Charter High School", "Sierra Canyon School", "Harvard-Westlake School", "Bishop Montgomery High School",
    "Etiwanda High School", "Chino Hills High School", "Corona Centennial High School", "Sheldon High School",
    "Modesto Christian School", "Berkeley High School", "Lincoln High School of San Diego", "Sacramento High School",
    "Oakland Technical High School", "San Leandro High School", "El Camino Real Charter High School",
    "Damien High School", "St. John Bosco High School", "Bishop O'Dowd High School", "De La Salle High School",
  ],
  CO: [
    "East High School (Denver)", "Cherry Creek High School", "Regis Jesuit High School", "Grandview High School",
    "Mullen High School", "Overland High School", "George Washington High School (Denver)", "Fairview High School",
    "Legend High School", "Eaglecrest High School", "Doherty High School", "Rangeview High School",
  ],
  CT: [
    "Hillhouse High School", "Weaver High School", "Notre Dame High School (West Haven)", "Xavier High School",
    "St. Joseph High School (Trumbull)", "Hall High School", "Trinity Catholic High School", "Hamden High School",
    "Bristol Central High School", "Danbury High School",
  ],
  DE: [
    "Salesianum School", "St. Elizabeth High School", "Sanford School", "Wilmington Friends School",
    "Caravel Academy", "Delaware Military Academy", "Sussex Central High School", "Dover High School",
  ],
  DC: [
    "Gonzaga College High School", "St. John's College High School", "Dunbar High School",
    "Wilson High School", "Archbishop Carroll High School", "Coolidge High School", "Ballou High School",
  ],
  FL: [
    "Miami Northwestern Senior High School", "Miami Norland Senior High School", "Miami Central Senior High School",
    "American Heritage School", "Dr. Phillips High School", "Winter Park High School", "Lake Highland Preparatory School",
    "Boyd Anderson High School", "Dillard High School", "Miami Edison Senior High School", "Booker T. Washington High School (Miami)",
    "Calvary Christian Academy", "University School (NSU)", "Palmetto Senior High School", "Cypress Bay High School",
    "St. Thomas Aquinas High School", "Plantation High School", "Chaminade-Madonna College Preparatory School",
  ],
  GA: [
    "Wheeler High School", "Westlake High School", "McEachern High School", "Norcross High School",
    "Grayson High School", "Berkmar High School", "Marietta High School", "North Gwinnett High School",
    "Milton High School", "Collins Hill High School", "Woodward Academy", "Westminster Schools",
    "Pace Academy", "Buford High School", "Colquitt County High School",
  ],
  HI: [
    "Saint Louis School", "Punahou School", "Kamehameha Schools", "Iolani School", "Farrington High School",
    "Kaiser High School", "Mililani High School", "Kailua High School", "Roosevelt High School (Honolulu)",
  ],
  ID: [
    "Boise High School", "Borah High School", "Mountain View High School", "Rocky Mountain High School",
    "Eagle High School", "Centennial High School (Boise)", "Coeur d'Alene High School", "Timberline High School",
  ],
  IL: [
    "Whitney Young High School", "Simeon Career Academy", "Curie Metropolitan High School", "Marshall Metropolitan High School",
    "Morgan Park High School", "Young Men's Leadership Academy", "New Trier High School", "Evanston Township High School",
    "Glenbard West High School", "Waukegan High School", "Proviso East High School", "Rich East High School",
    "Bolingbrook High School", "Peoria Manual High School", "St. Rita of Cascia High School", "Fenwick High School",
  ],
  IN: [
    "Ben Davis High School", "North Central High School (Indianapolis)", "Warren Central High School",
    "Carmel High School", "Lawrence North High School", "Lawrence Central High School", "Pike High School",
    "Southport High School", "Marion High School", "Fort Wayne North Side High School",
  ],
  IA: [
    "Des Moines East High School", "Roosevelt High School (Des Moines)", "Valley High School (West Des Moines)",
    "Waukee High School", "Ankeny High School", "Dowling Catholic High School", "Cedar Rapids Washington High School",
    "West High School (Iowa City)",
  ],
  KS: [
    "Wichita East High School", "Wichita Northwest High School", "Blue Valley Northwest High School",
    "Olathe East High School", "Shawnee Mission East High School", "Topeka High School", "Bishop Miege High School",
    "Free State High School",
  ],
  KY: [
    "Male High School", "Trinity High School (Louisville)", "St. Xavier High School", "Ballard High School",
    "Manual High School (Louisville)", "Lexington Catholic High School", "Bryan Station High School",
    "Christian County High School", "Covington Catholic High School",
  ],
  LA: [
    "Warren Easton Charter High School", "Edna Karr High School", "St. Augustine High School", "John Curtis Christian School",
    "Neville High School", "Southern Lab High School", "Zachary High School", "Catholic High School (Baton Rouge)",
    "Archbishop Rummel High School", "Evangel Christian Academy",
  ],
  ME: [
    "Deering High School", "Portland High School", "Cheverus High School", "Bangor High School",
    "Lewiston High School", "South Portland High School", "Falmouth High School",
  ],
  MD: [
    "DeMatha Catholic High School", "St. Frances Academy", "Paul VI Catholic High School", "Gonzaga College High School",
    "Dunbar High School (Baltimore)", "Riverdale Baptist School", "Springbrook High School", "Blake High School",
    "Good Counsel High School", "Whitman High School", "Wootton High School", "Poly High School (Baltimore)",
    "City College High School (Baltimore)",
  ],
  MA: [
    "Boston Latin School", "English High School", "Cathedral High School (Boston)", "Brighton High School",
    "Springfield Central High School", "Worcester South High School", "Cambridge Rindge and Latin School",
    "Malden Catholic High School", "St. John's Preparatory School", "Catholic Memorial School", "Newton North High School",
    "Brockton High School",
  ],
  MI: [
    "Cass Technical High School", "Renaissance High School", "Detroit Country Day School", "Southfield Christian School",
    "East Kentwood High School", "Ann Arbor Huron High School", "Grand Rapids Christian High School",
    "Belleville High School", "Clarkston High School", "Orchard Lake St. Mary's Preparatory",
  ],
  MN: [
    "Minneapolis North High School", "Minneapolis South High School", "Hopkins High School", "DeLaSalle High School",
    "Cretin-Derham Hall High School", "Wayzata High School", "Eden Prairie High School", "St. Louis Park High School",
    "Apple Valley High School",
  ],
  MS: [
    "Callaway High School", "Murrah High School", "Provine High School", "Germantown High School",
    "Oak Grove High School", "Hattiesburg High School", "Meridian High School", "Southaven High School",
  ],
  MO: [
    "Chaminade College Preparatory School", "Vashon High School", "Cardinal Ritter College Preparatory High School",
    "St. Louis University High School", "De Smet Jesuit High School", "Kickapoo High School", "Rockhurst High School",
    "Center High School (Kansas City)", "Sumner High School",
  ],
  MT: [
    "Billings Senior High School", "Billings West High School", "Missoula Sentinel High School",
    "Missoula Hellgate High School", "Great Falls High School", "Bozeman High School", "Butte High School",
  ],
  NE: [
    "Omaha Central High School", "Omaha North High School", "Omaha Bryan High School", "Lincoln High School (Nebraska)",
    "Millard North High School", "Creighton Preparatory School", "Bellevue West High School",
  ],
  NV: [
    "Bishop Gorman High School", "Findlay Prep", "Durango High School", "Clark High School (Las Vegas)",
    "Coronado High School (Henderson)", "Basic High School", "Reno High School", "Spanish Springs High School",
  ],
  NH: [
    "Manchester Central High School", "Manchester Memorial High School", "Nashua High School North",
    "Concord High School", "Bishop Guertin High School", "Pinkerton Academy",
  ],
  NJ: [
    "Roselle Catholic High School", "St. Benedict's Preparatory School", "Camden High School", "St. Anthony High School",
    "St. Patrick High School (Elizabeth)", "Union Catholic High School", "Elizabeth High School", "Newark East Side High School",
    "Bergen Catholic High School", "Don Bosco Preparatory High School", "Seton Hall Preparatory School",
    "Paterson Eastside High School", "Trenton Central High School", "Hudson Catholic Regional High School",
  ],
  NM: [
    "Albuquerque High School", "Eldorado High School", "La Cueva High School", "Cibola High School",
    "Rio Rancho High School", "Santa Fe High School", "Volcano Vista High School",
  ],
  NY: [
    "Long Island Lutheran", "Christ the King Regional High School", "Cardozo High School", "Boys and Girls High School",
    "Lincoln High School (Brooklyn)", "Thomas Jefferson High School (Brooklyn)", "Rice High School",
    "Cardinal Hayes High School", "Molloy High School", "St. Raymond High School for Boys", "Xaverian High School",
    "Bronx High School of Science", "Stuyvesant High School", "Erasmus Hall High School", "Half Hollow Hills High School East",
    "Elmira Free Academy", "McQuaid Jesuit High School", "Christian Brothers Academy (Syracuse)", "Niagara Falls High School",
  ],
  NC: [
    "Word of God Christian Academy", "Combine Academy", "Vertical Academy", "Christ School", "Providence Day School",
    "Charlotte Latin School", "Independence High School", "Butler High School", "East Mecklenburg High School",
    "Garner Magnet High School", "Southeast Raleigh High School", "Greensboro Dudley High School",
    "Winston-Salem Reynolds High School", "Wesleyan Christian Academy",
  ],
  ND: [
    "Fargo North High School", "Fargo South High School", "Bismarck High School", "Bismarck Century High School",
    "Grand Forks Central High School", "Minot High School",
  ],
  OH: [
    "St. Vincent-St. Mary High School", "Archbishop Hoban High School", "Cleveland Central Catholic High School",
    "Ginn Academy", "Glenville High School", "Withrow High School", "Moeller High School", "La Salle High School (Cincinnati)",
    "St. Edward High School", "Trotwood-Madison High School", "Findlay High School", "Pickerington Central High School",
    "Massillon Washington High School", "Canton McKinley High School", "Toledo Central Catholic High School",
  ],
  OK: [
    "Booker T. Washington High School (Tulsa)", "Douglass High School (Oklahoma City)", "Union High School (Tulsa)",
    "Jenks High School", "Edmond Memorial High School", "Broken Arrow High School", "Southmoore High School",
    "Bishop McGuinness Catholic High School",
  ],
  OR: [
    "Jefferson High School (Portland)", "Grant High School (Portland)", "Lincoln High School (Portland)",
    "Central Catholic High School (Portland)", "Jesuit High School", "Sunset High School", "West Linn High School",
    "South Medford High School",
  ],
  PA: [
    "Roman Catholic High School", "Neumann-Goretti High School", "Simon Gratz High School", "West Philadelphia High School",
    "Imhotep Institute Charter High School", "Chester High School", "Archbishop Wood Catholic High School",
    "La Salle College High School", "St. Joseph's Preparatory School", "Reading High School", "Erie McDowell High School",
    "Allderdice High School", "Central Catholic High School (Pittsburgh)", "Aliquippa High School", "Lincoln High School (Harrisburg)",
  ],
  RI: [
    "Hope High School", "Central Falls High School", "La Salle Academy", "Mount Pleasant High School",
    "Bishop Hendricken High School", "Cranston East High School",
  ],
  SC: [
    "Wren High School", "Dorman High School", "Byrnes High School", "Hammond School", "Northwestern High School",
    "Irmo High School", "Berkeley High School (SC)", "Ridge View High School",
  ],
  SD: [
    "Washington High School (Sioux Falls)", "Lincoln High School (Sioux Falls)", "Roosevelt High School (Sioux Falls)",
    "Rapid City Central High School", "Rapid City Stevens High School", "Aberdeen Central High School",
  ],
  TN: [
    "Melrose High School", "White Station High School", "East High School (Memphis)", "Whitehaven High School",
    "Ensworth School", "Montgomery Bell Academy", "Brentwood Academy", "Oak Ridge High School",
    "Hillsboro High School", "Maplewood High School", "Father Ryan High School",
  ],
  TX: [
    "Duncanville High School", "DeSoto High School", "Booker T. Washington High School for the Performing and Visual Arts",
    "South Oak Cliff High School", "Yates High School", "Madison High School (Houston)", "Westbury High School",
    "North Shore Senior High School", "Cy-Fair High School", "Katy High School", "Allen High School",
    "Prosper High School", "Westlake High School (Austin)", "Judson High School", "San Antonio Central Catholic Marianist School",
    "Lamar High School (Houston)", "Skyline High School (Dallas)", "Wagner High School",
  ],
  UT: [
    "Wasatch Academy", "Bingham High School", "Lone Peak High School", "American Fork High School",
    "Timpview High School", "East High School (Salt Lake City)", "Skyline High School (Salt Lake City)",
    "Corner Canyon High School",
  ],
  VT: [
    "Burlington High School", "Rice Memorial High School", "South Burlington High School", "Essex High School",
    "Mount Mansfield Union High School",
  ],
  VA: [
    "Oak Hill Academy", "Paul VI Catholic High School", "Bishop O'Connell High School", "Woodson High School",
    "Thomas Jefferson High School for Science and Technology", "Norview High School", "Oscar Smith High School",
    "Landstown High School", "Freedom High School (South Riding)", "Highland Springs High School",
    "L.C. Bird High School", "Hampton High School",
  ],
  WA: [
    "Garfield High School (Seattle)", "Rainier Beach High School", "O'Dea High School", "Franklin High School (Seattle)",
    "Bellevue High School", "Eastside Catholic School", "Curtis High School", "Union High School (Camas)",
    "Kentwood High School", "Federal Way High School",
  ],
  WV: [
    "Huntington Prep", "Huntington High School", "Charleston Catholic High School", "George Washington High School (Charleston)",
    "Capital High School", "Morgantown High School", "Wheeling Central Catholic High School",
  ],
  WI: [
    "Milwaukee Riverside University High School", "Rufus King High School", "Milwaukee Vincent High School",
    "Milwaukee King High School", "Racine St. Catherine's High School", "La Crosse Central High School",
    "Madison Memorial High School", "Wauwatosa East High School", "Sun Prairie High School",
  ],
  WY: [
    "Cheyenne Central High School", "Cheyenne East High School", "Natrona County High School",
    "Kelly Walsh High School", "Laramie High School",
  ],
};
