// Country-appropriate name pools for international prospects/players — not
// real people, just culturally authentic first/last name conventions so a
// Serbian recruit doesn't read as "Mason Harris".

interface NamePool {
  first: string[];
  last: string[];
}

const POOLS: Record<string, NamePool> = {
  Serbia: {
    first: ["Nikola", "Marko", "Stefan", "Milos", "Aleksandar", "Vuk", "Dusan", "Ognjen", "Bogdan", "Filip"],
    last: ["Jovanovic", "Petrovic", "Nikolic", "Markovic", "Djordjevic", "Stojanovic", "Ilic", "Pavlovic", "Milosevic", "Simic"],
  },
  Lithuania: {
    first: ["Mantas", "Dovydas", "Tadas", "Rokas", "Gytis", "Arnas", "Vytautas", "Titas", "Lukas", "Justas"],
    last: ["Kazlauskas", "Petrauskas", "Jankauskas", "Butkus", "Vasiliauskas", "Zukauskas", "Urbonas", "Simkus", "Adomaitis", "Stankevicius"],
  },
  France: {
    first: ["Mathis", "Lucas", "Nathan", "Theo", "Enzo", "Hugo", "Leo", "Adam", "Mohamed", "Jules"],
    last: ["Bernard", "Dubois", "Moreau", "Girard", "Fournier", "Lefevre", "Rousseau", "Diallo", "Traore", "Camara"],
  },
  Spain: {
    first: ["Alvaro", "Pablo", "Sergio", "Ivan", "Marc", "Dario", "Ruben", "Guillermo", "Xavier", "Adrian"],
    last: ["Garcia", "Fernandez", "Lopez", "Martinez", "Gonzalez", "Rodriguez", "Perez", "Sanchez", "Ramirez", "Torres"],
  },
  Croatia: {
    first: ["Luka", "Ivan", "Ante", "Josip", "Marin", "Karlo", "Petar", "Filip", "Dario", "Bruno"],
    last: ["Horvat", "Kovacevic", "Babic", "Maric", "Juric", "Novak", "Barisic", "Katic", "Peric", "Vukovic"],
  },
  Slovenia: {
    first: ["Luka", "Jan", "Ziga", "Klemen", "Jure", "Anze", "Rok", "Matic", "Nejc", "Gasper"],
    last: ["Novak", "Horvat", "Kovac", "Krajnc", "Zupan", "Potocnik", "Kovacic", "Bizjak", "Golob", "Kranjc"],
  },
  Greece: {
    first: ["Giannis", "Kostas", "Nikos", "Dimitris", "Panagiotis", "Yannis", "Vasilis", "Christos", "Thanasis", "Georgios"],
    last: ["Papadopoulos", "Papadakis", "Papageorgiou", "Katsivelis", "Vasilakis", "Georgiou", "Nikolaou", "Karagiannis", "Papas", "Economou"],
  },
  Germany: {
    first: ["Maximilian", "Lennard", "Finn", "Jonas", "Julian", "Niklas", "Paul", "Tim", "Elias", "Noah"],
    last: ["Muller", "Schmidt", "Schneider", "Fischer", "Weber", "Richter", "Becker", "Hoffmann", "Schulz", "Koch"],
  },
  Italy: {
    first: ["Marco", "Alessandro", "Matteo", "Andrea", "Lorenzo", "Simone", "Davide", "Riccardo", "Federico", "Gabriele"],
    last: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco"],
  },
  Turkey: {
    first: ["Emre", "Mert", "Baris", "Ozan", "Kerem", "Cem", "Berk", "Furkan", "Alper", "Yusuf"],
    last: ["Yilmaz", "Kaya", "Demir", "Sahin", "Celik", "Yildiz", "Aydin", "Ozturk", "Arslan", "Dogan"],
  },
  Latvia: {
    first: ["Kristaps", "Davis", "Roberts", "Janis", "Martins", "Karlis", "Rihards", "Toms", "Edgars", "Andris"],
    last: ["Berzins", "Kalnins", "Ozolins", "Balodis", "Krastins", "Zarins", "Liepins", "Vitolins", "Eglitis", "Jansons"],
  },
  Montenegro: {
    first: ["Nikola", "Marko", "Bojan", "Vasilije", "Dejan", "Petar", "Aleksa", "Stefan", "Filip", "Luka"],
    last: ["Vukovic", "Djuranovic", "Popovic", "Radulovic", "Ivanovic", "Perovic", "Radovic", "Jovovic", "Bulatovic", "Kovacevic"],
  },
  "Bosnia and Herzegovina": {
    first: ["Amar", "Emir", "Haris", "Adnan", "Kenan", "Tarik", "Nedim", "Elvir", "Damir", "Enis"],
    last: ["Hodzic", "Begic", "Music", "Kovac", "Halilovic", "Softic", "Delic", "Mujic", "Selimovic", "Suljic"],
  },
  "Czech Republic": {
    first: ["Jakub", "Tomas", "Vojtech", "Filip", "Ondrej", "Jan", "Marek", "David", "Lukas", "Adam"],
    last: ["Novak", "Svoboda", "Novotny", "Dvorak", "Cerny", "Prochazka", "Kucera", "Vesely", "Krejci", "Horak"],
  },
  Poland: {
    first: ["Jakub", "Kacper", "Filip", "Michal", "Bartosz", "Mateusz", "Wojciech", "Szymon", "Adrian", "Patryk"],
    last: ["Nowak", "Kowalski", "Wisniewski", "Wojcik", "Kowalczyk", "Kaminski", "Lewandowski", "Zielinski", "Szymanski", "Dabrowski"],
  },
  Ukraine: {
    first: ["Andriy", "Oleksandr", "Dmytro", "Vitalii", "Yevhen", "Mykola", "Bohdan", "Roman", "Taras", "Ivan"],
    last: ["Shevchenko", "Bondarenko", "Tkachenko", "Kravchenko", "Kovalenko", "Melnyk", "Boyko", "Ryabenko", "Marchenko", "Rudenko"],
  },
  Russia: {
    first: ["Ivan", "Dmitri", "Andrei", "Sergei", "Mikhail", "Alexei", "Nikolai", "Pavel", "Viktor", "Roman"],
    last: ["Ivanov", "Smirnov", "Kuznetsov", "Popov", "Volkov", "Sokolov", "Morozov", "Fedorov", "Kozlov", "Novikov"],
  },
  Belgium: {
    first: ["Thibault", "Arne", "Wout", "Sander", "Louis", "Bram", "Milan", "Jasper", "Warre", "Senne"],
    last: ["Peeters", "Janssens", "Maes", "Jacobs", "Willems", "Claes", "Goossens", "Wouters", "De Smet", "Mertens"],
  },
  Netherlands: {
    first: ["Daan", "Sem", "Milan", "Lars", "Bram", "Thijs", "Ruben", "Stijn", "Jesse", "Finn"],
    last: ["De Jong", "Jansen", "De Vries", "Van den Berg", "Van Dijk", "Bakker", "Visser", "Smit", "Meijer", "Mulder"],
  },
  Portugal: {
    first: ["Joao", "Diogo", "Tiago", "Rui", "Miguel", "Goncalo", "Bruno", "Andre", "Pedro", "Nuno"],
    last: ["Silva", "Santos", "Ferreira", "Pereira", "Oliveira", "Costa", "Rodrigues", "Martins", "Carvalho", "Gomes"],
  },
  Austria: {
    first: ["Lukas", "Felix", "Julian", "David", "Simon", "Florian", "Fabian", "Sebastian", "Jakob", "Maximilian"],
    last: ["Gruber", "Huber", "Bauer", "Wagner", "Mueller", "Pichler", "Steiner", "Moser", "Berger", "Fuchs"],
  },
  Switzerland: {
    first: ["Noah", "Luca", "Elias", "Nico", "Yannick", "Simon", "David", "Joel", "Livio", "Sandro"],
    last: ["Muller", "Meier", "Schmid", "Keller", "Weber", "Huber", "Baumann", "Frei", "Zimmermann", "Moser"],
  },
  Finland: {
    first: ["Elias", "Onni", "Leevi", "Eino", "Aatu", "Aleksi", "Väinö", "Niilo", "Otto", "Veeti"],
    last: ["Korhonen", "Virtanen", "Makinen", "Nieminen", "Hamalainen", "Laine", "Heikkinen", "Koskinen", "Jarvinen", "Lehtonen"],
  },
  Sweden: {
    first: ["Oskar", "Lucas", "William", "Elias", "Hugo", "Axel", "Alexander", "Viktor", "Anton", "Isak"],
    last: ["Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Gustafsson"],
  },
  Norway: {
    first: ["Jakob", "Emil", "Aksel", "Filip", "Oskar", "Noah", "Isak", "Elias", "Tobias", "Mathias"],
    last: ["Hansen", "Johansen", "Olsen", "Larsen", "Andersen", "Pedersen", "Nilsen", "Kristiansen", "Jensen", "Karlsen"],
  },
  Denmark: {
    first: ["Mikkel", "Frederik", "Lucas", "Oscar", "William", "Malthe", "Villads", "Magnus", "Emil", "Victor"],
    last: ["Nielsen", "Jensen", "Hansen", "Pedersen", "Andersen", "Christensen", "Larsen", "Sorensen", "Rasmussen", "Jorgensen"],
  },
  Hungary: {
    first: ["Bence", "Mate", "Levente", "Balazs", "Gergo", "Zoltan", "Andras", "Marton", "Peter", "Daniel"],
    last: ["Nagy", "Kovacs", "Toth", "Szabo", "Horvath", "Varga", "Kiss", "Molnar", "Nemeth", "Farkas"],
  },
  Romania: {
    first: ["Andrei", "Stefan", "Alexandru", "Mihai", "Cristian", "Bogdan", "Razvan", "Florin", "Gabriel", "Radu"],
    last: ["Popescu", "Ionescu", "Popa", "Stan", "Dumitru", "Constantin", "Gheorghe", "Radu", "Stoica", "Munteanu"],
  },
  Bulgaria: {
    first: ["Georgi", "Ivan", "Nikolay", "Stoyan", "Dimitar", "Aleksandar", "Petar", "Todor", "Vasil", "Kiril"],
    last: ["Ivanov", "Georgiev", "Dimitrov", "Petrov", "Stoyanov", "Nikolov", "Todorov", "Angelov", "Marinov", "Kolev"],
  },
  Georgia: {
    first: ["Giorgi", "Luka", "Nika", "Saba", "Levan", "Beka", "Data", "Irakli", "Zurab", "Davit"],
    last: ["Beridze", "Kapanadze", "Lomidze", "Gelashvili", "Tsereteli", "Japaridze", "Mamulashvili", "Kiknadze", "Sikharulidze", "Chkheidze"],
  },
  Estonia: {
    first: ["Karl", "Markus", "Rasmus", "Sander", "Kristjan", "Andres", "Mihkel", "Tanel", "Marten", "Robert"],
    last: ["Tamm", "Saar", "Sepp", "Mägi", "Kask", "Kukk", "Rebane", "Ilves", "Pärn", "Koppel"],
  },
  "North Macedonia": {
    first: ["Filip", "Stefan", "Marko", "Aleksandar", "Bojan", "Petar", "Ivan", "Damjan", "Nikola", "Vlatko"],
    last: ["Stojanov", "Nikolov", "Petrov", "Trajkovski", "Angelov", "Ristovski", "Dimitrov", "Kostov", "Georgiev", "Todorov"],
  },
};

export function randomInternationalFirstName(rng: () => number, country: string): string {
  const pool = POOLS[country]?.first ?? POOLS.France.first;
  return pool[Math.floor(rng() * pool.length)];
}

export function randomInternationalLastName(rng: () => number, country: string): string {
  const pool = POOLS[country]?.last ?? POOLS.France.last;
  return pool[Math.floor(rng() * pool.length)];
}
