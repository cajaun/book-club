// hand-arranged genres by title, a bare title stands spine out, stacks start at the bottom, spaces are in cm

export type LayoutItem = string | { face: string } | { stack: string[] } | { space: number };

export const HAND_LAYOUTS: LayoutItem[][] = [
  [
    { stack: ["Emma", "Sense and Sensibility", "Persuasion"] },
    { space: 2 },
    "The Awakening", "The House of Mirth", "Wuthering Heights", "Jane Eyre", "The Age of Innocence", "Villette", "Madame Bovary", "Middlemarch",
    { space: 12 },
    { stack: ["Little Women"] },
    { space: 9 },
    "The Portrait of a Lady", "Daisy Miller", "Cranford", "Mansfield Park", "North and South", "A Room with a View", "Lord Jim", "The Lost World",
  ],
  [
    { face: "Anna Karenina" },
    { space: 1 },
    "Moby-Dick", "Bleak House", "Great Expectations", "Crime and Punishment", "War and Peace", "The Brothers Karamazov", "Don Quixote", "Vanity Fair",
    { space: 14 },
    { stack: ["Fathers and Sons", "Eugene Onegin", "Dead Souls"] },
    { space: 2 },
    "Les Misérables", "Germinal", "Tess of the d'Urbervilles", "The Red and the Black", "Ulysses",
  ],
  [
    { face: "Frankenstein" },
    { space: 1 },
    "The Woman in White", "The Moonstone", "Carmilla", "The Turn of the Screw", "Uncle Silas", "The Castle of Otranto", "The Monk",
    { space: 3 },
    { stack: ["The Hound of the Baskervilles", "The Sign of Four", "A Study in Scarlet", "Dracula"] },
    { space: 3 },
    "Tales of Mystery", "Dr Jekyll and Mr Hyde", "The Picture of Dorian Gray", "The Phantom of the Opera", "The Secret Adversary", "The Mysteries of Udolpho", "The Invisible Man", "Northanger Abbey", "The Hunchback of Notre-Dame",
  ],
  [
    { face: "Leaves of Grass" },
    { space: 1 },
    "The Republic", "Walden", "Essays", "The Prince", "Leviathan", "Beyond Good and Evil", "Paradise Lost", "The Divine Comedy",
    { space: 9 },
    { stack: ["The Prophet", "Poems", "Gitanjali"] },
    { space: 2 },
    "The Iliad", "The Odyssey", "Songs of Innocence", "The Waste Land", "Lyrical Ballads", "Sonnets", "On Liberty", "The Social Contract",
    { space: 1 },
    { face: "Meditations" },
  ],
  [
    { face: "The Three Musketeers" },
    { space: 1 },
    "The Count of Monte Cristo", "Around the World in Eighty Days", "Twenty Thousand Leagues", "Kidnapped", "The Call of the Wild", "Robinson Crusoe",
    { space: 1 },
    { face: "Treasure Island" },
    { space: 1 },
    "Black Beauty", "The Jungle Book", "Peter Pan",
    { space: 5 },
    { stack: ["The Wonderful Wizard of Oz", "Alice's Adventures in Wonderland", "The Wind in the Willows"] },
    { space: 2 },
    "Gulliver's Travels", "The Time Machine", "Heart of Darkness", "The Swiss Family Robinson", "King Solomon's Mines", "The Last of the Mohicans",
  ],
];
