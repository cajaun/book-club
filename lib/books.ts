// Catalogue + initial shelf arrangement.
// The manifest is the single source of truth: the 3D scene, the detail
// panel, search and the accessible book list are all derived from it.

export type Pose = "spine" | "face" | "flat";
export type SpineStyle = "cloth" | "paper" | "label" | "ribbed" | "pattern";
export type CoverStyle =
  | "frame"
  | "sunburst"
  | "stripes"
  | "dots"
  | "waves"
  | "emblem"
  | "arch"
  | "panel";

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  pages: number;
  blurb: string;
  genre: string;
  shelf: number;
  price: number;
  // physical size in cm
  h: number; // height
  t: number; // thickness (spine width)
  d: number; // depth (cover width)
  base: string; // board colour
  ink: string; // title colour
  accent: string; // ornament / band colour
  spine: SpineStyle;
  cover: CoverStyle;
}

export type Entry =
  | { kind: "book"; id: string; pose: "spine" | "face" }
  | { kind: "stack"; ids: string[] }
  | { kind: "space"; w: number };

export const SHELVES = [
  "Staff Picks",
  "The Great Novels",
  "Gothic & Mystery",
  "Poetry & Ideas",
  "Adventure & Wonder",
];
export const ROMAN = ["I", "II", "III", "IV", "V"];

// [title, author, year, pages, blurb]
type Row = [string, string, number, number, string];

const CATALOGUE: Row[][] = [
  [
    ["Persuasion", "Jane Austen", 1817, 272, "Eight years after being talked out of a marriage, Anne Elliot meets the man again — now a captain, and a stranger."],
    ["Sense and Sensibility", "Jane Austen", 1811, 384, "Two sisters, one ruled by her head and one by her heart, learn what each has to teach the other."],
    ["Emma", "Jane Austen", 1815, 474, "A clever, comfortable matchmaker discovers she understands everyone's heart but her own."],
    ["The Awakening", "Kate Chopin", 1899, 192, "One summer on the Gulf coast, a young wife begins to want a life that is entirely hers."],
    ["The House of Mirth", "Edith Wharton", 1905, 352, "Lily Bart has beauty, taste and no money, in a New York that forgives everything but the last."],
    ["Wuthering Heights", "Emily Brontë", 1847, 416, "On the Yorkshire moors, a love too fierce for its house tears through two generations."],
    ["Jane Eyre", "Charlotte Brontë", 1847, 532, "A plain, unbending governess and a house at Thornfield with a secret on its third floor."],
    ["The Age of Innocence", "Edith Wharton", 1920, 368, "Newland Archer is engaged to the perfect girl, until her scandalous cousin comes home."],
    ["Villette", "Charlotte Brontë", 1853, 576, "Lucy Snowe crosses to a foreign city to teach, watch, and very carefully not be seen."],
    ["Madame Bovary", "Gustave Flaubert", 1856, 432, "A doctor's wife in provincial Normandy reads too many novels and believes every one."],
    ["Middlemarch", "George Eliot", 1871, 880, "A whole English town, its hopes and marriages and small betrayals, seen with perfect kindness."],
    ["Little Women", "Louisa May Alcott", 1868, 528, "Four March sisters grow up through a hard winter of war, each wanting something different."],
    ["The Portrait of a Lady", "Henry James", 1881, 656, "Isabel Archer inherits a fortune and the freedom to choose — and chooses wrongly, and bravely."],
    ["Daisy Miller", "Henry James", 1878, 96, "An American girl in Europe flouts every rule, and Rome is not as forgiving as she is."],
    ["Cranford", "Elizabeth Gaskell", 1853, 224, "The genteel ladies of a small town keep up appearances on very little money and great dignity."],
    ["Mansfield Park", "Jane Austen", 1814, 480, "Quiet Fanny Price, raised among rich cousins, holds her ground when everyone else gives way."],
    ["North and South", "Elizabeth Gaskell", 1855, 528, "A parson's daughter moves to a mill town and clashes with the master of its biggest mill."],
    ["A Room with a View", "E. M. Forster", 1908, 256, "In a Florentine pension, Lucy Honeychurch is offered a better room and a less proper life."],
  ],
  [
    ["Anna Karenina", "Leo Tolstoy", 1878, 864, "All happy families are alike; Anna's is about to become unhappy in its own particular way."],
    ["Moby-Dick", "Herman Melville", 1851, 720, "Call him Ishmael. He has signed on to a whaler whose captain is hunting one whale only."],
    ["Bleak House", "Charles Dickens", 1853, 1040, "An inheritance case drags through Chancery for generations while fog settles over London."],
    ["Great Expectations", "Charles Dickens", 1861, 544, "An orphan blacksmith's boy is lifted into fortune by a benefactor he must never ask about."],
    ["Crime and Punishment", "Fyodor Dostoevsky", 1866, 576, "A penniless student commits a murder to prove a theory, and the theory begins to fail him."],
    ["War and Peace", "Leo Tolstoy", 1869, 1296, "Napoleon marches on Russia, and three families are swept from ballrooms onto battlefields."],
    ["The Brothers Karamazov", "Fyodor Dostoevsky", 1880, 824, "A father is murdered, and each of his sons must decide what he is guilty of."],
    ["Don Quixote", "Miguel de Cervantes", 1605, 1072, "An old gentleman reads himself into knighthood and rides out to set the world right."],
    ["Vanity Fair", "William Makepeace Thackeray", 1848, 912, "Becky Sharp climbs through Regency society on wit, nerve and other people's money."],
    ["Les Misérables", "Victor Hugo", 1862, 1463, "A convict breaks parole and spends a lifetime becoming the man a bishop believed he was."],
    ["Dead Souls", "Nikolai Gogol", 1842, 464, "A smooth stranger tours the provinces buying up serfs who have already died."],
    ["Eugene Onegin", "Alexander Pushkin", 1833, 240, "A bored dandy rejects a country girl's letter, and spends the rest of his life regretting it."],
    ["Fathers and Sons", "Ivan Turgenev", 1862, 288, "A young nihilist comes home with a friend and finds he cannot argue with his own heart."],
    ["Germinal", "Émile Zola", 1885, 592, "In the coal country of northern France, a hungry mining town walks out on strike."],
    ["Tess of the d'Urbervilles", "Thomas Hardy", 1891, 528, "A country girl learns of a noble ancestry, and every door it opens leads somewhere worse."],
    ["The Red and the Black", "Stendhal", 1830, 576, "A carpenter's son with Napoleon's portrait under his mattress schemes his way upward."],
    ["Ulysses", "James Joyce", 1922, 736, "One ordinary June day in Dublin, told in every way a day can be told."],
    ["Lord Jim", "Joseph Conrad", 1900, 416, "A young officer jumps from a ship he believes is sinking, and spends his life after the leap."],
  ],
  [
    ["Frankenstein", "Mary Shelley", 1818, 288, "A young scientist builds a man from the dead, and then runs from what he has made."],
    ["The Woman in White", "Wilkie Collins", 1859, 720, "A drawing master meets a woman in white on a moonlit road, fleeing an asylum."],
    ["The Moonstone", "Wilkie Collins", 1868, 528, "A sacred diamond vanishes on a girl's birthday, and every witness tells it differently."],
    ["Carmilla", "Sheridan Le Fanu", 1872, 128, "A lonely girl in a Styrian castle welcomes a beautiful guest who sleeps all day."],
    ["The Turn of the Screw", "Henry James", 1898, 128, "A governess becomes certain the two children in her care are being visited."],
    ["Uncle Silas", "Sheridan Le Fanu", 1864, 480, "An heiress is sent to live with her strange uncle in his crumbling house in Derbyshire."],
    ["The Castle of Otranto", "Horace Walpole", 1764, 160, "A giant helmet falls from the sky, and the first Gothic novel begins."],
    ["The Monk", "Matthew Lewis", 1796, 464, "The most admired preacher in Madrid falls, slowly and then all at once."],
    ["Dracula", "Bram Stoker", 1897, 448, "Told in letters and diaries: a Transylvanian count comes to London, and a small band of friends sets out to hunt him."],
    ["A Study in Scarlet", "Arthur Conan Doyle", 1887, 176, "A wounded army doctor takes rooms at Baker Street with a most unusual flatmate."],
    ["The Sign of Four", "Arthur Conan Doyle", 1890, 160, "A young woman receives a pearl every year from an unknown hand, and then a letter."],
    ["The Hound of the Baskervilles", "Arthur Conan Doyle", 1902, 256, "A legend of a spectral hound on Dartmoor, and a fresh set of footprints."],
    ["Tales of Mystery", "Edgar Allan Poe", 1845, 320, "Beating hearts beneath floorboards, a house that falls, and the first detective."],
    ["Dr Jekyll and Mr Hyde", "Robert Louis Stevenson", 1886, 112, "A respected London doctor has an unpleasant acquaintance with a key to his laboratory."],
    ["The Picture of Dorian Gray", "Oscar Wilde", 1890, 272, "A beautiful young man stays young while his portrait, locked away, does the ageing."],
    ["The Phantom of the Opera", "Gaston Leroux", 1910, 368, "Beneath the Paris Opéra, someone is teaching a young singer, and listening."],
    ["The Secret Adversary", "Agatha Christie", 1922, 304, "Two broke young friends advertise themselves as adventurers, and someone answers."],
    ["The Mysteries of Udolpho", "Ann Radcliffe", 1794, 704, "An orphaned heroine is carried off to a castle in the Apennines full of veiled things."],
    ["The Invisible Man", "H. G. Wells", 1897, 192, "A bandaged stranger takes a room at a village inn in the middle of winter."],
    ["Northanger Abbey", "Jane Austen", 1817, 256, "A girl who reads too much Radcliffe is invited to a real abbey and imagines the worst."],
    ["The Hunchback of Notre-Dame", "Victor Hugo", 1831, 512, "The bell-ringer of Notre-Dame, a dancer in the square, and a city that cannot see either."],
  ],
  [
    ["Leaves of Grass", "Walt Whitman", 1855, 464, "I celebrate myself, and sing myself — a poet who tried to hold all of America in one book."],
    ["The Republic", "Plato", -375, 416, "Socrates asks what justice is, and builds an entire city to find out."],
    ["Walden", "Henry David Thoreau", 1854, 352, "Two years in a cabin by a pond, living deliberately, and reporting back."],
    ["Essays", "Ralph Waldo Emerson", 1841, 320, "Trust thyself: the essays that taught a young country to think for itself."],
    ["The Prince", "Niccolò Machiavelli", 1532, 144, "A handbook for rulers, written by a man out of work and out of favour."],
    ["Leviathan", "Thomas Hobbes", 1651, 736, "Life without a state is nasty, brutish and short; here is the case for the state."],
    ["Beyond Good and Evil", "Friedrich Nietzsche", 1886, 240, "A philosophy of the future, written with a hammer and a great deal of style."],
    ["Paradise Lost", "John Milton", 1667, 464, "The fall of the rebel angels and of man, in the grandest verse in English."],
    ["The Divine Comedy", "Dante Alighieri", 1320, 798, "Midway through life, in a dark wood, a poet begins the long walk down and then up."],
    ["Gitanjali", "Rabindranath Tagore", 1910, 128, "Song offerings: the short, radiant poems that won Tagore the Nobel Prize."],
    ["Poems", "Emily Dickinson", 1890, 224, "Tell all the truth but tell it slant — the poems found in a dresser after her death."],
    ["The Prophet", "Kahlil Gibran", 1923, 112, "Before he sails home, a prophet answers the townspeople's questions about love, work and grief."],
    ["The Iliad", "Homer", -750, 704, "Sing, goddess, the rage of Achilles — and the war it nearly loses."],
    ["The Odyssey", "Homer", -725, 560, "Ten years at war and ten years getting home: the original long way round."],
    ["Songs of Innocence", "William Blake", 1794, 96, "Tyger, tyger: the lamb and the tiger side by side, engraved and hand-coloured."],
    ["The Waste Land", "T. S. Eliot", 1922, 64, "April is the cruellest month — the poem that broke modern poetry open."],
    ["Lyrical Ballads", "Wordsworth & Coleridge", 1798, 240, "Two friends set out to write poetry in the language really used by men."],
    ["Sonnets", "William Shakespeare", 1609, 176, "One hundred and fifty-four little rooms, each with a different view of love."],
    ["On Liberty", "John Stuart Mill", 1859, 160, "The only freedom which deserves the name is that of pursuing our own good in our own way."],
    ["The Social Contract", "Jean-Jacques Rousseau", 1762, 192, "Man is born free, and everywhere he is in chains."],
    ["Meditations", "Marcus Aurelius", 180, 256, "Private notes from an emperor to himself on how to be a decent person."],
  ],
  [
    ["The Three Musketeers", "Alexandre Dumas", 1844, 704, "A young Gascon rides to Paris and fights three duels in a day with his future best friends."],
    ["The Count of Monte Cristo", "Alexandre Dumas", 1844, 1276, "Wrongly imprisoned for fourteen years, a sailor escapes with a fortune and a list."],
    ["Around the World in Eighty Days", "Jules Verne", 1872, 256, "Phileas Fogg bets his fortune that he can circle the globe on schedule."],
    ["Twenty Thousand Leagues", "Jules Verne", 1870, 448, "A sea monster turns out to be a submarine, and its captain has no plans to surface."],
    ["Kidnapped", "Robert Louis Stevenson", 1886, 288, "Cheated of his inheritance, young David Balfour is sold onto a ship bound for the Carolinas."],
    ["The Call of the Wild", "Jack London", 1903, 128, "A pampered dog is stolen from California and sold into the Klondike gold rush."],
    ["Robinson Crusoe", "Daniel Defoe", 1719, 320, "Shipwrecked alone, a sailor builds a life — and finds a footprint in the sand."],
    ["Treasure Island", "Robert Louis Stevenson", 1883, 304, "A map, a one-legged cook, and a boy who keeps his head when the grown-ups lose theirs."],
    ["Black Beauty", "Anna Sewell", 1877, 240, "The life of a horse, told by the horse, from green meadows to London cab ranks."],
    ["The Jungle Book", "Rudyard Kipling", 1894, 224, "A boy raised by wolves learns the Law of the Jungle from a bear and a panther."],
    ["Peter Pan", "J. M. Barrie", 1911, 192, "Second star to the right and straight on till morning — with the boy who won't grow up."],
    ["The Wind in the Willows", "Kenneth Grahame", 1908, 256, "Mole, Rat, Badger and the irrepressible Toad, messing about in boats."],
    ["Alice's Adventures in Wonderland", "Lewis Carroll", 1865, 192, "A girl follows a white rabbit down a hole, and nothing follows sensibly after."],
    ["The Wonderful Wizard of Oz", "L. Frank Baum", 1900, 224, "A cyclone, a yellow brick road, and three friends who already have what they want."],
    ["Gulliver's Travels", "Jonathan Swift", 1726, 336, "A ship's surgeon visits tiny people, giant people, flying islands and wise horses."],
    ["The Time Machine", "H. G. Wells", 1895, 128, "A Victorian inventor travels to the year 802,701 and does not like what he finds."],
    ["Heart of Darkness", "Joseph Conrad", 1899, 112, "A steamer captain goes up the Congo to find a company man who has gone too far."],
    ["The Swiss Family Robinson", "Johann David Wyss", 1812, 368, "A shipwrecked family builds a treehouse and a whole world on a tropical island."],
    ["King Solomon's Mines", "H. Rider Haggard", 1885, 288, "Three Englishmen follow a crumbling map across a desert in search of a lost brother."],
    ["The Last of the Mohicans", "James Fenimore Cooper", 1826, 432, "In the French and Indian War, a scout and two Mohicans guide two sisters through the forest."],
    ["The Lost World", "Arthur Conan Doyle", 1912, 288, "Professor Challenger leads an expedition to a plateau where the dinosaurs never left."],
  ],
];

// curated board colours (base, ink)
const PALETTE: [string, string, string][] = [
  ["#7c1f1c", "#e8cf8a", "#d8b46a"], // oxblood
  ["#1f3b2e", "#e5cf8d", "#c9a95d"], // forest
  ["#1c2740", "#e6d29a", "#c7a560"], // navy
  ["#c9952e", "#2b1d12", "#7a1f18"], // mustard
  ["#e9dfc6", "#2a2018", "#b4382d"], // cream
  ["#93a37c", "#21281a", "#6d2a20"], // sage
  ["#d6684a", "#fbefd9", "#3a2018"], // terracotta
  ["#17130f", "#d8b46a", "#a33a2c"], // black
  ["#4a2141", "#e6cf93", "#c49c58"], // plum
  ["#1f5653", "#efdca5", "#d0aa5c"], // teal
  ["#b8463c", "#f4e6c8", "#2b1810"], // brick
  ["#e7c9c0", "#4a1d1d", "#b03a36"], // rose
  ["#2c2c2a", "#e9d9ae", "#b9934c"], // charcoal
  ["#5d6b3c", "#f0e2b4", "#c8a35a"], // olive
  ["#a8b9a2", "#1d2a24", "#7b2b23"], // celadon
  ["#efe8d6", "#1d2338", "#2f4a7a"], // ivory/blue
];

const FEATURED: Record<string, Partial<Book>> = {
  dracula: { base: "#241a35", ink: "#e2c477", accent: "#c8a252", cover: "frame", spine: "label", t: 4.2, h: 24, d: 16.5 },
  frankenstein: { base: "#2a2522", ink: "#f0e4cc", accent: "#d8442e", cover: "sunburst", spine: "cloth", h: 24 },
  "little-women": { base: "#b7363a", ink: "#3b1414", accent: "#f2e6dc", cover: "stripes", spine: "pattern", h: 22, d: 16 },
  meditations: { base: "#c9d8a6", ink: "#2c3b1f", accent: "#6f8f45", cover: "dots", spine: "pattern", h: 23 },
  "treasure-island": { base: "#dcc8e3", ink: "#2b2340", accent: "#ffffff", cover: "waves", spine: "paper", h: 24, d: 17, t: 3.4 },
  "leaves-of-grass": { base: "#1e5b52", ink: "#efe2b8", accent: "#cfa95a", cover: "emblem", spine: "cloth", h: 25 },
  "anna-karenina": { base: "#1d1a17", ink: "#d8b46a", accent: "#c79d55", cover: "arch", spine: "ribbed", h: 27 },
  "the-three-musketeers": { base: "#6b3f7a", ink: "#f2e7d6", accent: "#e9d9f0", cover: "stripes", spine: "pattern", h: 26 },
  middlemarch: { base: "#efe6cf", ink: "#2b211a", accent: "#c8362d", spine: "paper", h: 29 },
  "madame-bovary": { base: "#ece2c8", ink: "#2a2018", accent: "#2b2b2b", spine: "paper", h: 27 },
  gitanjali: { base: "#d8a531", ink: "#2b1d12", accent: "#8a2a1c" },
};

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// deterministic PRNG so the shelf is identical on every load
export function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPINES: SpineStyle[] = ["cloth", "paper", "label", "ribbed", "pattern", "cloth", "label", "paper"];
const COVERS: CoverStyle[] = ["frame", "emblem", "arch", "panel", "dots", "stripes", "waves", "sunburst", "emblem", "panel"];

export const BOOKS: Book[] = [];
export const BOOK_BY_ID: Record<string, Book> = {};

CATALOGUE.forEach((rows, shelf) => {
  rows.forEach(([title, author, year, pages, blurb], i) => {
    const id = slug(title);
    const r = rng(id);
    const pal = PALETTE[Math.floor(r() * PALETTE.length)];
    const h = Math.round((21 + r() * 9) * 10) / 10;
    const t = Math.round(Math.min(4.8, Math.max(1.5, 1.1 + pages / 340 + r() * 0.7)) * 10) / 10;
    const book: Book = {
      id,
      title,
      author,
      year,
      pages,
      blurb,
      genre: SHELVES[shelf],
      shelf,
      price: 18 + Math.round(r() * 24),
      h,
      t,
      d: Math.round(h * (0.64 + r() * 0.06) * 10) / 10,
      base: pal[0],
      ink: pal[1],
      accent: pal[2],
      spine: SPINES[(i * 3 + shelf) % SPINES.length],
      cover: COVERS[Math.floor(r() * COVERS.length)],
      ...FEATURED[id],
    };
    if (FEATURED[id]?.h && !FEATURED[id]?.d) book.d = Math.round(book.h * 0.68 * 10) / 10;
    if (id === "dracula") book.price = 38;
    BOOKS.push(book);
    BOOK_BY_ID[id] = book;
  });
});

const b = (title: string, pose: "spine" | "face" = "spine"): Entry => ({ kind: "book", id: slug(title), pose });
const st = (...titles: string[]): Entry => ({ kind: "stack", ids: titles.map(slug) });
const sp = (w: number): Entry => ({ kind: "space", w });
const run = (...titles: string[]) => titles.map((t) => b(t));

// Mirrors the arrangement in the reference video: runs of spines broken by
// gaps, small laid-flat stacks and the odd face-out cover.
export const INITIAL_SHELVES: Entry[][] = [
  [
    st("Emma", "Sense and Sensibility", "Persuasion"),
    sp(2),
    ...run("The Awakening", "The House of Mirth", "Wuthering Heights", "Jane Eyre", "The Age of Innocence", "Villette", "Madame Bovary", "Middlemarch"),
    sp(12),
    st("Little Women"),
    sp(9),
    ...run("The Portrait of a Lady", "Daisy Miller", "Cranford", "Mansfield Park", "North and South", "A Room with a View", "Lord Jim", "The Lost World"),
  ],
  [
    b("Anna Karenina", "face"),
    sp(1),
    ...run("Moby-Dick", "Bleak House", "Great Expectations", "Crime and Punishment", "War and Peace", "The Brothers Karamazov", "Don Quixote", "Vanity Fair"),
    sp(14),
    st("Fathers and Sons", "Eugene Onegin", "Dead Souls"),
    sp(2),
    ...run("Les Misérables", "Germinal", "Tess of the d'Urbervilles", "The Red and the Black", "Ulysses"),
  ],
  [
    b("Frankenstein", "face"),
    sp(1),
    ...run("The Woman in White", "The Moonstone", "Carmilla", "The Turn of the Screw", "Uncle Silas", "The Castle of Otranto", "The Monk"),
    sp(3),
    st("The Hound of the Baskervilles", "The Sign of Four", "A Study in Scarlet", "Dracula"),
    sp(3),
    ...run("Tales of Mystery", "Dr Jekyll and Mr Hyde", "The Picture of Dorian Gray", "The Phantom of the Opera", "The Secret Adversary", "The Mysteries of Udolpho", "The Invisible Man", "Northanger Abbey", "The Hunchback of Notre-Dame"),
  ],
  [
    b("Leaves of Grass", "face"),
    sp(1),
    ...run("The Republic", "Walden", "Essays", "The Prince", "Leviathan", "Beyond Good and Evil", "Paradise Lost", "The Divine Comedy"),
    sp(9),
    st("The Prophet", "Poems", "Gitanjali"),
    sp(2),
    ...run("The Iliad", "The Odyssey", "Songs of Innocence", "The Waste Land", "Lyrical Ballads", "Sonnets", "On Liberty", "The Social Contract"),
    sp(1),
    b("Meditations", "face"),
  ],
  [
    b("The Three Musketeers", "face"),
    sp(1),
    ...run("The Count of Monte Cristo", "Around the World in Eighty Days", "Twenty Thousand Leagues", "Kidnapped", "The Call of the Wild", "Robinson Crusoe"),
    sp(1),
    b("Treasure Island", "face"),
    sp(1),
    ...run("Black Beauty", "The Jungle Book", "Peter Pan"),
    sp(5),
    st("The Wonderful Wizard of Oz", "Alice's Adventures in Wonderland", "The Wind in the Willows"),
    sp(2),
    ...run("Gulliver's Travels", "The Time Machine", "Heart of Darkness", "The Swiss Family Robinson", "King Solomon's Mines", "The Last of the Mohicans"),
  ],
];

export function formatYear(y: number) {
  return y < 0 ? `${-y} BC` : `${y}`;
}
