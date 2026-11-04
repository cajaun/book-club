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
  "Plays & Drama",
  "Science & Discovery",
  "History & Letters",
  "Tales & Fables",
  "Myth & Legend",
  "Modern Classics",
  "American Voices",
  "Sea & Travel",
  "Philosophy & Wisdom",
  "Children's Classics",
];
export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
/** Shelves per bookcase bay. */
export const ROWS_PER_BAY = 5;

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
  [
    ["Hamlet", "William Shakespeare", 1603, 192, "A prince is visited by his father's ghost and asked to do the one thing he cannot make himself do."],
    ["Macbeth", "William Shakespeare", 1623, 128, "Three witches, one prophecy, and a husband and wife who will not wait for fate."],
    ["King Lear", "William Shakespeare", 1608, 208, "An old king divides his kingdom by flattery and is left with nothing but the truth."],
    ["Othello", "William Shakespeare", 1622, 176, "A trusted ensign drips poison into a general's ear, one handkerchief at a time."],
    ["A Midsummer Night's Dream", "William Shakespeare", 1600, 112, "Four lovers, a troupe of players and a fairy king lose themselves in one enchanted wood."],
    ["The Tempest", "William Shakespeare", 1623, 128, "On an island of spirits, an exiled duke raises a storm and then decides to let it go."],
    ["Romeo and Juliet", "William Shakespeare", 1597, 160, "Two households, both alike in dignity, and the two children who end their feud."],
    ["Twelfth Night", "William Shakespeare", 1623, 128, "Shipwrecked in Illyria, a woman disguises herself as a man and falls for her master."],
    ["The Importance of Being Earnest", "Oscar Wilde", 1895, 96, "Two young men invent alter egos named Ernest, and both are found out at tea."],
    ["A Doll's House", "Henrik Ibsen", 1879, 112, "Nora Helmer has kept one secret for her husband's sake; the door she closes is famous."],
    ["Hedda Gabler", "Henrik Ibsen", 1891, 128, "A general's daughter, newly married and bored to death, takes hold of other people's lives."],
    ["The Cherry Orchard", "Anton Chekhov", 1904, 96, "A family returns to its estate as the orchard is sold, and nobody quite says goodbye."],
    ["Uncle Vanya", "Anton Chekhov", 1898, 96, "A professor and his young wife visit the country estate that has paid for everything."],
    ["The Seagull", "Anton Chekhov", 1896, 96, "An actress, a writer and two young people who want to be them, by a lake in summer."],
    ["Oedipus Rex", "Sophocles", -429, 96, "A king vows to find the cause of the plague on Thebes, and keeps his word."],
    ["Medea", "Euripides", -431, 80, "Abandoned in a foreign city by the husband she saved, a sorceress plans her answer."],
    ["Faust", "Johann Wolfgang von Goethe", 1808, 480, "A scholar who has read everything makes a wager with the devil for one perfect moment."],
    ["Tartuffe", "Molière", 1664, 112, "A pious fraud moves into a wealthy household and very nearly takes it over."],
    ["Cyrano de Bergerac", "Edmond Rostand", 1897, 240, "A poet-swordsman with a famous nose writes love letters for a handsomer man."],
    ["Pygmalion", "George Bernard Shaw", 1913, 128, "A phonetics professor bets he can pass off a flower girl as a duchess."],
  ],
  [
    ["On the Origin of Species", "Charles Darwin", 1859, 512, "One long argument, built from barnacles, pigeons and finches, for how life changes."],
    ["The Voyage of the Beagle", "Charles Darwin", 1839, 496, "Five years at sea with a young naturalist who has not yet had his idea."],
    ["The Descent of Man", "Charles Darwin", 1871, 704, "Darwin turns his theory, carefully and controversially, on ourselves."],
    ["Principia", "Isaac Newton", 1687, 974, "Three laws of motion and one of gravity, and the heavens and the earth obey them both."],
    ["Opticks", "Isaac Newton", 1704, 416, "A prism, a dark room and a beam of sunlight: the colours were in the light all along."],
    ["Dialogue Concerning the Two Chief World Systems", "Galileo Galilei", 1632, 512, "Three friends debate whether the earth moves; the Inquisition took the other side."],
    ["The Starry Messenger", "Galileo Galilei", 1610, 96, "A new telescope, the moons of Jupiter and mountains on the moon, reported in a hurry."],
    ["Elements", "Euclid", -300, 528, "From five postulates, the whole of plane geometry, in the order it is still taught."],
    ["Relativity", "Albert Einstein", 1916, 176, "Einstein explains special and general relativity to the general reader, with trains."],
    ["The Interpretation of Dreams", "Sigmund Freud", 1899, 640, "Every dream is a wish, Freud argues, and he begins with his own."],
    ["Micrographia", "Robert Hooke", 1665, 320, "A flea the size of a page, and the first use of the word cell."],
    ["Flatland", "Edwin A. Abbott", 1884, 112, "A square in a two-dimensional world is visited by a sphere and cannot explain it."],
    ["The Wealth of Nations", "Adam Smith", 1776, 1264, "Pin factories, the division of labour and the invisible hand."],
    ["The Natural History of Selborne", "Gilbert White", 1789, 288, "A country parson watches swifts, tortoises and weather in one English village for forty years."],
    ["Kosmos", "Alexander von Humboldt", 1845, 480, "An explorer's attempt to describe the whole physical universe as one connected thing."],
    ["The Principles of Psychology", "William James", 1890, 1408, "The stream of consciousness, habit and attention, in the founding text of the field."],
    ["Novum Organum", "Francis Bacon", 1620, 336, "A new instrument for the mind: observe first, theorise after."],
    ["Experiments in Plant Hybridization", "Gregor Mendel", 1866, 64, "Eight years of pea plants in a monastery garden, and the laws of inheritance."],
  ],
  [
    ["The Histories", "Herodotus", -430, 768, "The first history: the Persian Wars, and every marvel the author heard along the way."],
    ["The Peloponnesian War", "Thucydides", -400, 640, "Athens and Sparta destroy each other, recorded by a general who lost a battle in it."],
    ["The Decline and Fall of the Roman Empire", "Edward Gibbon", 1776, 1312, "Thirteen centuries of Rome's long fall, told with irony and magnificent sentences."],
    ["The Annals", "Tacitus", 116, 464, "Rome under Tiberius, Claudius and Nero, written by a man who saw where it led."],
    ["Parallel Lives", "Plutarch", 100, 864, "Famous Greeks and Romans in pairs, judged by their characters rather than their battles."],
    ["The Gallic War", "Julius Caesar", -50, 288, "Caesar's own account of conquering Gaul, written in the third person."],
    ["Letters to a Young Poet", "Rainer Maria Rilke", 1929, 96, "Ten letters to a young man who asked whether he should write. Go into yourself."],
    ["The Diary of Samuel Pepys", "Samuel Pepys", 1825, 576, "The plague, the Great Fire and a great deal of dinner, in a private shorthand diary."],
    ["Confessions", "Augustine of Hippo", 400, 352, "A restless young man's account of the years before he found rest."],
    ["The Autobiography of Benjamin Franklin", "Benjamin Franklin", 1791, 256, "A printer's apprentice runs away to Philadelphia and becomes nearly everything else."],
    ["Narrative of the Life of Frederick Douglass", "Frederick Douglass", 1845, 144, "Written by himself: how a man who was enslaved learned to read, and walked free."],
    ["Democracy in America", "Alexis de Tocqueville", 1835, 928, "A young French aristocrat tours the United States and sees its future clearly."],
    ["The Federalist Papers", "Hamilton, Madison & Jay", 1788, 624, "Eighty-five essays arguing a new country into ratifying its constitution."],
    ["Common Sense", "Thomas Paine", 1776, 64, "Forty-seven pages that turned a colonial grievance into a revolution."],
    ["A Vindication of the Rights of Woman", "Mary Wollstonecraft", 1792, 320, "Educate women as rational beings, and see what they become."],
    ["The Souls of Black Folk", "W. E. B. Du Bois", 1903, 272, "The problem of the twentieth century is the problem of the colour line."],
    ["Up from Slavery", "Booker T. Washington", 1901, 224, "From a slave cabin in Virginia to the founding of Tuskegee."],
    ["The Travels of Marco Polo", "Marco Polo", 1300, 352, "A Venetian merchant's account of Kublai Khan's court, dictated from a prison cell."],
    ["Letters from an American Farmer", "J. Hector St. John de Crèvecœur", 1782, 256, "What, then, is the American, this new man?"],
  ],
  [
    ["Aesop's Fables", "Aesop", -550, 224, "The tortoise and the hare, the fox and the grapes, and the boy who cried wolf."],
    ["Grimms' Fairy Tales", "Jacob & Wilhelm Grimm", 1812, 576, "Hansel and Gretel, Rapunzel, Rumpelstiltskin, and the dark woods around them."],
    ["Andersen's Fairy Tales", "Hans Christian Andersen", 1835, 448, "The little mermaid, the ugly duckling and the emperor with no clothes."],
    ["One Thousand and One Nights", "Anonymous", 800, 896, "Scheherazade tells a king a story each night, and stops just before the ending."],
    ["Dubliners", "James Joyce", 1914, 224, "Fifteen stories of a city's paralysis, ending in snow falling faintly on the living and the dead."],
    ["The Canterbury Tales", "Geoffrey Chaucer", 1400, 512, "Thirty pilgrims ride to Canterbury and tell stories to win a free supper."],
    ["The Decameron", "Giovanni Boccaccio", 1353, 864, "Ten young Florentines flee the plague and tell a hundred stories in ten days."],
    ["The Metamorphosis", "Franz Kafka", 1915, 96, "Gregor Samsa wakes one morning transformed into a monstrous insect, and is late for work."],
    ["The Overcoat", "Nikolai Gogol", 1842, 64, "A poor clerk saves for a new coat, and it becomes the whole of his life."],
    ["The Lady with the Dog", "Anton Chekhov", 1899, 64, "A holiday affair in Yalta that both of them expect to forget."],
    ["The Legend of Sleepy Hollow", "Washington Irving", 1820, 96, "A schoolmaster rides home through the Hudson Valley, and something rides after him."],
    ["The Gift of the Magi", "O. Henry", 1905, 48, "A poor young couple each sell their one treasure to buy the other a Christmas present."],
    ["The Yellow Wallpaper", "Charlotte Perkins Gilman", 1892, 64, "Confined to a nursery for a rest cure, a young mother begins to see a woman in the pattern."],
    ["Bartleby, the Scrivener", "Herman Melville", 1853, 64, "A Wall Street copyist who would prefer not to."],
    ["The Necklace", "Guy de Maupassant", 1884, 48, "A clerk's wife borrows a diamond necklace for one evening, and loses it."],
    ["Just So Stories", "Rudyard Kipling", 1902, 192, "How the leopard got his spots, and how the camel got his hump, O Best Beloved."],
    ["Winesburg, Ohio", "Sherwood Anderson", 1919, 256, "The lonely, secret lives of one small town, told through a young reporter."],
    ["Tales from Shakespeare", "Charles & Mary Lamb", 1807, 320, "Twenty plays retold as stories for young readers by a brother and sister."],
  ],
  [
    ["The Epic of Gilgamesh", "Anonymous", -1200, 128, "The oldest story we have: a king, his wild friend, and the search for eternal life."],
    ["Beowulf", "Anonymous", 1000, 160, "A hero crosses the sea to kill a monster, and then the monster's mother."],
    ["The Aeneid", "Virgil", -19, 448, "A Trojan survivor carries his father and his gods out of the burning city towards Rome."],
    ["Metamorphoses", "Ovid", 8, 608, "Two hundred and fifty myths of bodies changed into new forms, from chaos to Caesar."],
    ["The Mahabharata", "Vyasa", -400, 960, "The great war of two branches of one family, and everything else besides."],
    ["The Ramayana", "Valmiki", -300, 512, "Prince Rama's exile, the abduction of Sita, and the long road to Lanka."],
    ["Le Morte d'Arthur", "Thomas Malory", 1485, 960, "The whole Arthurian legend, from the sword in the stone to the last battle."],
    ["Sir Gawain and the Green Knight", "Anonymous", 1390, 128, "A green giant rides into Camelot at Christmas and offers a deadly game."],
    ["The Song of Roland", "Anonymous", 1100, 160, "Charlemagne's rearguard is ambushed at Roncevaux, and Roland is too proud to sound his horn."],
    ["The Nibelungenlied", "Anonymous", 1200, 416, "Siegfried, Kriemhild and a hoard of gold at the bottom of the Rhine."],
    ["The Kalevala", "Elias Lönnrot", 1835, 672, "Finland's epic of singers, smiths and the magic mill called the Sampo."],
    ["The Poetic Edda", "Anonymous", 1270, 384, "Odin, Thor and the end of the world, in the poems of the Norse gods."],
    ["Theogony", "Hesiod", -700, 96, "How the Greek gods were born, and how Zeus came to rule them."],
    ["The Argonautica", "Apollonius of Rhodes", -250, 224, "Jason and his heroes sail to the edge of the world for a golden fleece."],
    ["The Tale of Genji", "Murasaki Shikibu", 1010, 1216, "A shining prince's loves and losses at the Heian court, in what may be the first novel."],
    ["Journey to the West", "Wu Cheng'en", 1592, 1024, "A monk travels to India for scriptures, protected by a monkey king who once fought heaven."],
    ["The Shahnameh", "Ferdowsi", 1010, 896, "Fifty thousand couplets of Persian kings and heroes, from the creation to the Arab conquest."],
    ["The Mabinogion", "Anonymous", 1350, 288, "Welsh tales of enchanted hounds, a woman made of flowers and the hero Pwyll."],
  ],
  [
    ["The Great Gatsby", "F. Scott Fitzgerald", 1925, 192, "A self-made millionaire throws parties across the bay from the green light he cannot reach."],
    ["Mrs Dalloway", "Virginia Woolf", 1925, 224, "One June day in London, a society hostess buys the flowers herself."],
    ["To the Lighthouse", "Virginia Woolf", 1927, 240, "A family's summers on Skye, a trip to the lighthouse postponed for ten years."],
    ["Orlando", "Virginia Woolf", 1928, 336, "A young nobleman lives for three hundred years and wakes one morning a woman."],
    ["A Passage to India", "E. M. Forster", 1924, 368, "Something happened in the Marabar Caves, and no one in Chandrapore will agree what."],
    ["Howards End", "E. M. Forster", 1910, 352, "Only connect: two sisters, a business family and a house in Hertfordshire."],
    ["The Sun Also Rises", "Ernest Hemingway", 1926, 256, "A lost generation drinks its way from Paris to the bullfights in Pamplona."],
    ["The Magic Mountain", "Thomas Mann", 1924, 720, "A young engineer visits his cousin at a Swiss sanatorium and stays for seven years."],
    ["Siddhartha", "Hermann Hesse", 1922, 160, "A Brahmin's son leaves home in search of enlightenment and finds a river."],
    ["Of Human Bondage", "W. Somerset Maugham", 1915, 688, "An orphan with a club foot struggles towards art, medicine and an unworthy love."],
    ["The Good Soldier", "Ford Madox Ford", 1915, 256, "This is the saddest story I have ever heard, says a narrator who missed everything."],
    ["Sons and Lovers", "D. H. Lawrence", 1913, 512, "A miner's son is torn between his mother and the women who love him."],
    ["Women in Love", "D. H. Lawrence", 1920, 592, "Two sisters in a Midlands mining town and the two men they choose."],
    ["Swann's Way", "Marcel Proust", 1913, 464, "A madeleine dipped in tea, and a whole childhood comes flooding back."],
    ["The Trial", "Franz Kafka", 1925, 256, "Someone must have slandered Josef K., for one morning he was arrested."],
    ["My Ántonia", "Willa Cather", 1918, 288, "A Bohemian immigrant girl and the Nebraska prairie that shaped them both."],
    ["O Pioneers!", "Willa Cather", 1913, 192, "Alexandra Bergson tames a Nebraska farm that broke her father."],
    ["Ethan Frome", "Edith Wharton", 1911, 128, "A sled, a winter night and a farmer trapped between duty and longing."],
    ["The Beautiful and Damned", "F. Scott Fitzgerald", 1922, 432, "A golden couple waits for an inheritance and slowly spends themselves."],
  ],
  [
    ["Adventures of Huckleberry Finn", "Mark Twain", 1884, 368, "A boy and a runaway slave float down the Mississippi on a raft, towards freedom."],
    ["The Adventures of Tom Sawyer", "Mark Twain", 1876, 272, "Whitewashed fences, a cave, a treasure and a murder on the river."],
    ["The Scarlet Letter", "Nathaniel Hawthorne", 1850, 272, "In Puritan Boston, a woman wears an embroidered A and keeps a name to herself."],
    ["The House of the Seven Gables", "Nathaniel Hawthorne", 1851, 336, "A curse on a New England family and the gloomy house that carries it."],
    ["Uncle Tom's Cabin", "Harriet Beecher Stowe", 1852, 640, "The novel that, Lincoln is said to have joked, started a great war."],
    ["The Red Badge of Courage", "Stephen Crane", 1895, 160, "A young Union soldier runs from his first battle and must find his way back."],
    ["Sister Carrie", "Theodore Dreiser", 1900, 576, "A country girl comes to Chicago and rises as the man who loves her falls."],
    ["The Jungle", "Upton Sinclair", 1906, 416, "A Lithuanian family in the Chicago stockyards, and what goes into the sausages."],
    ["McTeague", "Frank Norris", 1899, 432, "A San Francisco dentist, a lottery ticket and a marriage gone to greed."],
    ["A Connecticut Yankee in King Arthur's Court", "Mark Twain", 1889, 352, "A factory foreman wakes up in Camelot and starts improving things."],
    ["Billy Budd", "Herman Melville", 1924, 144, "A handsome young sailor, a master-at-arms who hates him, and the law of the sea."],
    ["The Rise of Silas Lapham", "William Dean Howells", 1885, 384, "A self-made paint millionaire tries to buy his way into Boston society."],
    ["Washington Square", "Henry James", 1880, 224, "A plain heiress, a charming suitor and a father certain he is after the money."],
    ["The Country of the Pointed Firs", "Sarah Orne Jewett", 1896, 160, "A summer in a fishing village on the coast of Maine."],
    ["Pudd'nhead Wilson", "Mark Twain", 1894, 224, "Two babies switched in their cradles, and a lawyer with a collection of fingerprints."],
    ["Herland", "Charlotte Perkins Gilman", 1915, 160, "Three explorers stumble on a country of women who have done perfectly well without men."],
    ["Main Street", "Sinclair Lewis", 1920, 464, "A city librarian marries a small-town doctor and tries to improve Gopher Prairie."],
    ["Babbitt", "Sinclair Lewis", 1922, 400, "A realtor in the city of Zenith begins to suspect there is more to life."],
  ],
  [
    ["Two Years Before the Mast", "Richard Henry Dana Jr.", 1840, 432, "A Harvard student signs on as a common sailor around Cape Horn to California."],
    ["Typee", "Herman Melville", 1846, 320, "A deserting sailor lives among islanders in a Marquesan valley, and wonders if he can leave."],
    ["The Sea-Wolf", "Jack London", 1904, 368, "A literary critic is fished out of the sea by a captain who rules his ship by force."],
    ["Captains Courageous", "Rudyard Kipling", 1897, 224, "A spoiled rich boy falls off a liner and is raised by a Grand Banks fishing crew."],
    ["The Innocents Abroad", "Mark Twain", 1869, 528, "Twain joins a pleasure cruise to Europe and the Holy Land and is not impressed."],
    ["Life on the Mississippi", "Mark Twain", 1883, 432, "Twain's years learning to pilot a steamboat on the great river."],
    ["Roughing It", "Mark Twain", 1872, 592, "Silver mines, stagecoaches and Hawaii: Twain's young years in the West."],
    ["Travels with a Donkey", "Robert Louis Stevenson", 1879, 160, "Twelve days walking the Cévennes with an obstinate donkey called Modestine."],
    ["The Oregon Trail", "Francis Parkman", 1849, 384, "A young Bostonian rides west with the emigrants and the Oglala Sioux."],
    ["Journey to the Center of the Earth", "Jules Verne", 1864, 256, "A professor, his nephew and a guide climb down an Icelandic volcano."],
    ["From the Earth to the Moon", "Jules Verne", 1865, 224, "A Baltimore gun club decides to fire a cannon at the moon, with passengers."],
    ["The Mysterious Island", "Jules Verne", 1875, 544, "Five castaways escape by balloon and build a civilisation on an uncharted island."],
    ["The Riddle of the Sands", "Erskine Childers", 1903, 336, "Two young Englishmen sailing the Frisian islands stumble on an invasion plan."],
    ["Typhoon", "Joseph Conrad", 1902, 112, "A stolid captain steers straight into the storm because the book says to."],
    ["Moonfleet", "J. Meade Falkner", 1898, 288, "A Dorset boy, a smugglers' vault and a diamond hidden in a dead man's locket."],
    ["Kim", "Rudyard Kipling", 1901, 368, "An Irish orphan on the streets of Lahore becomes a lama's disciple and a spy."],
    ["The Man Who Would Be King", "Rudyard Kipling", 1888, 96, "Two adventurers set out to make themselves kings of Kafiristan."],
    ["Eothen", "Alexander Kinglake", 1844, 288, "A young Englishman's witty journey through the Ottoman East."],
  ],
  [
    ["The Analects", "Confucius", -475, 224, "Sayings of the Master on learning, ritual and how to be a good person."],
    ["Tao Te Ching", "Laozi", -400, 128, "Eighty-one short chapters on the way that cannot be named."],
    ["The Art of War", "Sun Tzu", -500, 112, "The supreme art of war is to subdue the enemy without fighting."],
    ["The Bhagavad Gita", "Vyasa", -200, 176, "On the eve of battle, a prince hesitates, and his charioteer turns out to be a god."],
    ["The Dhammapada", "The Buddha", -250, 128, "The Buddha's teachings gathered into four hundred and twenty-three verses."],
    ["Nicomachean Ethics", "Aristotle", -340, 336, "What is the good life? Aristotle's answer: virtue, practised, among friends."],
    ["The Trial and Death of Socrates", "Plato", -399, 96, "Socrates defends himself before Athens, refuses to escape, and drinks the hemlock."],
    ["Enchiridion", "Epictetus", 125, 64, "Some things are in our control and others not: a freed slave's handbook for living."],
    ["Letters from a Stoic", "Seneca", 65, 256, "A Roman statesman's letters to a friend on time, death and how to live well."],
    ["Utopia", "Thomas More", 1516, 160, "A traveller describes an island where everything is held in common."],
    ["Candide", "Voltaire", 1759, 144, "A young optimist is assured that all is for the best, and then everything happens to him."],
    ["Pensées", "Blaise Pascal", 1670, 384, "The heart has its reasons which reason knows nothing of."],
    ["Discourse on Method", "René Descartes", 1637, 96, "I think, therefore I am: doubting everything to find one sure thing."],
    ["The Essays of Montaigne", "Michel de Montaigne", 1580, 1344, "A retired magistrate writes about everything, and invents the essay to do it."],
    ["Thus Spoke Zarathustra", "Friedrich Nietzsche", 1883, 352, "A prophet comes down from the mountain to announce the death of God."],
    ["Fear and Trembling", "Søren Kierkegaard", 1843, 160, "Abraham, Isaac and the leap of faith, examined by a writer under a pseudonym."],
    ["Critique of Pure Reason", "Immanuel Kant", 1781, 784, "What can we know? Kant draws the boundaries of reason itself."],
    ["An Essay Concerning Human Understanding", "John Locke", 1689, 752, "The mind begins as a blank slate, and experience writes on it."],
  ],
  [
    ["The Secret Garden", "Frances Hodgson Burnett", 1911, 288, "A sour orphan finds the key to a locked garden on a Yorkshire estate."],
    ["A Little Princess", "Frances Hodgson Burnett", 1905, 256, "A rich girl at a London boarding school loses everything except her imagination."],
    ["Anne of Green Gables", "L. M. Montgomery", 1908, 320, "An elderly brother and sister send for an orphan boy and get Anne, with an e."],
    ["Heidi", "Johanna Spyri", 1881, 304, "A little girl is sent to live with her grandfather high in the Swiss Alps."],
    ["Pinocchio", "Carlo Collodi", 1883, 192, "A wooden puppet runs away from the carpenter who made him, and his nose grows."],
    ["The Velveteen Rabbit", "Margery Williams", 1922, 48, "A stuffed rabbit learns what it means to become Real."],
    ["The Tale of Peter Rabbit", "Beatrix Potter", 1902, 64, "A disobedient rabbit squeezes under the gate into Mr. McGregor's garden."],
    ["Five Children and It", "E. Nesbit", 1902, 224, "Five children dig up a grumpy sand-fairy who grants one wish a day."],
    ["The Railway Children", "E. Nesbit", 1906, 256, "Three children move to the country and wave at the trains, hoping for their father."],
    ["The Princess and the Goblin", "George MacDonald", 1872, 240, "A princess, a miner's boy and the goblins tunnelling beneath the castle."],
    ["At the Back of the North Wind", "George MacDonald", 1871, 368, "A coachman's son is carried through the night by the North Wind."],
    ["Pollyanna", "Eleanor H. Porter", 1913, 256, "An orphan plays the glad game in her stern aunt's house, and the town catches it."],
    ["Rebecca of Sunnybrook Farm", "Kate Douglas Wiggin", 1903, 320, "A lively girl from a poor family goes to live with her two strict aunts."],
    ["The Water-Babies", "Charles Kingsley", 1863, 288, "A young chimney sweep falls into a river and becomes a water-baby."],
    ["Through the Looking-Glass", "Lewis Carroll", 1871, 224, "Alice climbs through the mirror into a land laid out like a chessboard."],
    ["The Story of Doctor Dolittle", "Hugh Lofting", 1920, 176, "A country doctor learns to talk to animals and sails to Africa to cure the monkeys."],
    ["Winnie-the-Pooh", "A. A. Milne", 1926, 176, "A bear of very little brain and his friends in the Hundred Acre Wood."],
    ["Hans Brinker", "Mary Mapes Dodge", 1865, 336, "A poor Dutch boy dreams of winning the silver skates."],
    ["Black Arrow", "Robert Louis Stevenson", 1888, 288, "An outlaw band in the Wars of the Roses, signing their deeds with a black arrow."],
  ],
];

// curated board colours (base, ink, accent), sampled to match the reference:
// mostly deep cloth colours, with the odd cream paperback for contrast
const PALETTE: [string, string, string][] = [
  ["#6a1a1c", "#e3c98a", "#cfae68"], // oxblood
  ["#7d2320", "#ecd9a8", "#d6b46a"], // crimson
  ["#22412f", "#e2cc8e", "#c6a65e"], // bottle green
  ["#2e4a32", "#ead8a4", "#c9a95d"], // forest
  ["#1d2840", "#e3cf98", "#c4a35e"], // navy
  ["#273352", "#e8d6a6", "#c9a862"], // ink blue
  ["#b5862c", "#2a1b10", "#6e1d16"], // mustard
  ["#1b4846", "#ebd9a2", "#cda85a"], // teal
  ["#181512", "#d6b46a", "#a33a2c"], // black
  ["#3d1d38", "#e3cc90", "#c29a56"], // plum
  ["#5b6532", "#efe0b2", "#c8a35a"], // olive
  ["#a9502e", "#f3e3c4", "#2e1a10"], // terracotta
  ["#8f9a72", "#1f271b", "#6b2a20"], // sage
  ["#2b2a28", "#e6d6aa", "#b8924b"], // charcoal
  ["#e2d9c0", "#2a2018", "#a8352b"], // cream
  ["#8a2f2a", "#f0e2c2", "#2b1810"], // brick
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

const SPINES: SpineStyle[] = ["cloth", "label", "cloth", "ribbed", "paper", "cloth", "label", "pattern", "cloth", "ribbed"];
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
    if (BOOK_BY_ID[id]) throw new Error(`duplicate book id: ${id}`);
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

// Shelves VI-X: arranged by the same pattern as the reference (a face-out
// cover, runs of spines, one small stack, breathing gaps).
for (let shelf = INITIAL_SHELVES.length; shelf < SHELVES.length; shelf++) {
  const ids = BOOKS.filter((b) => b.shelf === shelf).map((b) => b.id);
  const r = rng("arrange" + shelf);
  const face = ids.shift()!;
  const stackAt = 6 + Math.floor(r() * 4);
  const stack = ids.splice(stackAt, 3);
  const row: Entry[] = [{ kind: "book", id: face, pose: "face" }, { kind: "space", w: 1 }];
  ids.forEach((id, i) => {
    if (i === stackAt) row.push({ kind: "space", w: 6 }, { kind: "stack", ids: stack }, { kind: "space", w: 2 });
    row.push({ kind: "book", id, pose: "spine" });
  });
  INITIAL_SHELVES.push(row);
}

/**
 * The five rows of the bookcase. Each row holds three genres in sequence
 * (row r: genres r, r+5, r+10); a phone shows the first, wider screens more.
 */
export function initialRows(): Entry[][] {
  const clone = (e: Entry): Entry => (e.kind === "stack" ? { ...e, ids: [...e.ids] } : { ...e });
  return Array.from({ length: ROWS_PER_BAY }, (_, r) => {
    const row: Entry[] = [];
    for (let g = r; g < INITIAL_SHELVES.length; g += ROWS_PER_BAY) {
      if (row.length) row.push({ kind: "space", w: 10 });
      row.push(...INITIAL_SHELVES[g].map(clone));
    }
    return row;
  });
}

export function formatYear(y: number) {
  return y < 0 ? `${-y} BC` : `${y}`;
}
