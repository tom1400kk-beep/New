// Real cities/towns per country, used to give international prospects/players
// a specific, plausible hometown instead of just a country name — same idea
// as cities.ts's CITIES_BY_STATE for domestic recruits.
export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  // ---- Europe ----
  Serbia: ["Belgrade", "Novi Sad", "Nis", "Kragujevac", "Subotica", "Cacak"],
  Lithuania: ["Vilnius", "Kaunas", "Klaipeda", "Siauliai", "Panevezys"],
  France: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Bordeaux"],
  Spain: ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Malaga", "Bilbao"],
  Croatia: ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar"],
  Slovenia: ["Ljubljana", "Maribor", "Celje", "Kranj", "Koper"],
  Greece: ["Athens", "Thessaloniki", "Patras", "Piraeus", "Larissa"],
  Germany: ["Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt", "Stuttgart", "Dusseldorf"],
  Italy: ["Rome", "Milan", "Naples", "Turin", "Bologna", "Florence", "Venice"],
  Turkey: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"],
  Latvia: ["Riga", "Daugavpils", "Liepaja", "Jelgava"],
  Montenegro: ["Podgorica", "Niksic", "Herceg Novi"],
  "Bosnia and Herzegovina": ["Sarajevo", "Banja Luka", "Mostar", "Tuzla"],
  "Czech Republic": ["Prague", "Brno", "Ostrava", "Plzen"],
  Poland: ["Warsaw", "Krakow", "Lodz", "Wroclaw", "Poznan", "Gdansk"],
  Ukraine: ["Kyiv", "Kharkiv", "Odesa", "Dnipro", "Lviv"],
  Russia: ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan"],
  Belgium: ["Brussels", "Antwerp", "Ghent", "Charleroi", "Liege"],
  Netherlands: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
  Portugal: ["Lisbon", "Porto", "Braga", "Coimbra"],
  Austria: ["Vienna", "Graz", "Linz", "Salzburg"],
  Switzerland: ["Zurich", "Geneva", "Basel", "Bern", "Lausanne"],
  Finland: ["Helsinki", "Espoo", "Tampere", "Turku"],
  Sweden: ["Stockholm", "Gothenburg", "Malmo", "Uppsala"],
  Norway: ["Oslo", "Bergen", "Trondheim", "Stavanger"],
  Denmark: ["Copenhagen", "Aarhus", "Odense", "Aalborg"],
  Hungary: ["Budapest", "Debrecen", "Szeged", "Miskolc"],
  Romania: ["Bucharest", "Cluj-Napoca", "Timisoara", "Iasi"],
  Bulgaria: ["Sofia", "Plovdiv", "Varna", "Burgas"],
  Georgia: ["Tbilisi", "Batumi", "Kutaisi"],
  Estonia: ["Tallinn", "Tartu", "Narva"],
  "North Macedonia": ["Skopje", "Bitola", "Kumanovo"],

  // ---- Rest of the world ----
  Canada: ["Toronto", "Montreal", "Vancouver", "Ottawa", "Calgary", "Edmonton", "Winnipeg", "Brampton"],
  Nigeria: ["Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt", "Benin City"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra"],
  Senegal: ["Dakar", "Thies", "Kaolack", "Saint-Louis"],
  Cameroon: ["Yaounde", "Douala", "Garoua", "Bafoussam"],
  "Dominican Republic": ["Santo Domingo", "Santiago", "La Romana", "San Pedro de Macoris"],
  Argentina: ["Buenos Aires", "Cordoba", "Rosario", "Mendoza", "La Plata"],
  Brazil: ["Sao Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasilia", "Salvador", "Recife"],
  "South Sudan": ["Juba", "Wau", "Malakal"],
  Mali: ["Bamako", "Sikasso", "Mopti"],
  China: ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Wuhan", "Chengdu"],
  Japan: ["Tokyo", "Osaka", "Nagoya", "Yokohama", "Fukuoka"],
  Philippines: ["Manila", "Quezon City", "Cebu City", "Davao City"],
  Venezuela: ["Caracas", "Maracaibo", "Valencia", "Barquisimeto"],
  "DR Congo": ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kisangani"],
  Israel: ["Tel Aviv", "Jerusalem", "Haifa", "Beersheba"],
  "New Zealand": ["Auckland", "Wellington", "Christchurch", "Hamilton"],
  Bahamas: ["Nassau", "Freeport"],
};

export function pickCityForCountry(rng: () => number, country: string): string {
  const cities = CITIES_BY_COUNTRY[country];
  if (!cities || cities.length === 0) return "";
  return cities[Math.floor(rng() * cities.length)];
}
