// Procedural name pools. Not tied to any real person.

export const FIRST_NAMES = [
  "Marcus","Jalen","Trevon","DeAndre","Isaiah","Xavier","Malik","Jaylen","Cameron","Elijah",
  "Tyrese","Amari","Kobe","Josiah","Terrence","Devin","Jordan","Kyree","Zion","Andre",
  "Brandon","Chris","Darius","Emmanuel","Frank","Gabriel","Hakeem","Ibrahim","Javon","Keon",
  "Lamar","Micah","Nasir","Omar","Preston","Quentin","Rashad","Sterling","Tariq","Uriah",
  "Vince","Wesley","Xander","Yusuf","Zachary","Aiden","Blake","Caleb","Dominic","Ethan",
  "Finn","Grant","Hunter","Ian","Jack","Kellen","Logan","Mason","Nolan","Owen",
  "Parker","Quinn","Ryan","Sean","Tyler","Vaughn","Will","Aaron","Bryce","Cole",
  "Deshawn","Eli","Fabian","Gage","Harold","Isaac","Jamal","Kyle","Landon","Miles",
  "Nate","Oscar","Pierce","Reggie","Shawn","Trent","Victor","Walker","Antoine","Bryson",
];

export const LAST_NAMES = [
  "Johnson","Williams","Brown","Jones","Davis","Miller","Wilson","Moore","Taylor","Anderson",
  "Thomas","Jackson","White","Harris","Martin","Thompson","Robinson","Clark","Lewis","Walker",
  "Hall","Allen","Young","King","Wright","Scott","Green","Baker","Adams","Nelson",
  "Carter","Mitchell","Roberts","Turner","Phillips","Campbell","Parker","Evans","Edwards","Collins",
  "Stewart","Sanchez","Morris","Rogers","Reed","Cook","Bell","Murphy","Bailey","Rivera",
  "Cooper","Richardson","Cox","Howard","Ward","Torres","Peterson","Gray","Ramirez","James",
  "Watson","Brooks","Kelly","Sanders","Price","Bennett","Wood","Barnes","Ross","Henderson",
  "Coleman","Jenkins","Perry","Powell","Long","Patterson","Hughes","Flores","Washington","Butler",
  "Simmons","Foster","Gonzales","Bryant","Alexander","Russell","Griffin","Diaz","Hayes","Myers",
];

export function randomFirstName(rng: () => number): string {
  return FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
}

export function randomLastName(rng: () => number): string {
  return LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
}
