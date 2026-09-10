export type QuestionType = "GENERAL" | "PATTERN" | "CODE";

export type Puzzle = {
  id: number;          // 0 to 17
  doorNumber: number;  // 1 to 18
  roundId: 1 | 2 | 3;
  type: QuestionType;
  title: string;
  desc: string;
  content: string;
  answer: string;
  acceptedAnswers: string[];
  hint: string;
  fragment: string;
};

export type RoundConfig = {
  id: 1 | 2 | 3;
  title: string;
  subtitle: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  doorRange: [number, number]; // 1-indexed [1, 6], [7, 12], [13, 18]
  doorIndices: number[];       // 0-indexed [0..5], [6..11], [12..17]
  masterKeyOrder: string[];
  masterKeyDisplay: string;
  theme: "perimeter" | "core" | "protocol";
};

export const ROUNDS_CONFIG: Record<1 | 2 | 3, RoundConfig> = {
  1: {
    id: 1,
    title: "ROUND 01",
    subtitle: "THE PERIMETER BREACH",
    difficulty: "EASY",
    doorRange: [1, 6],
    doorIndices: [0, 1, 2, 3, 4, 5],
    masterKeyOrder: ["428", "731", "195", "604", "382", "917"],
    masterKeyDisplay: "428-731-195-604-382-917",
    theme: "perimeter",
  },
  2: {
    id: 2,
    title: "ROUND 02",
    subtitle: "THE CORE INFILTRATION",
    difficulty: "MEDIUM",
    doorRange: [7, 12],
    doorIndices: [6, 7, 8, 9, 10, 11],
    masterKeyOrder: ["513", "842", "267", "905", "374", "689"],
    masterKeyDisplay: "513-842-267-905-374-689",
    theme: "core",
  },
  3: {
    id: 3,
    title: "ROUND 03",
    subtitle: "THE FINAL PROTOCOL",
    difficulty: "HARD",
    doorRange: [13, 18],
    doorIndices: [12, 13, 14, 15, 16, 17],
    masterKeyOrder: ["624", "189", "753", "802", "346", "915"],
    masterKeyDisplay: "624-189-753-802-346-915",
    theme: "protocol",
  },
};

export const ALL_PUZZLES: Puzzle[] = [
  // =========================================================================
  // ROUND 01 — THE PERIMETER BREACH (Doors 01 - 06)
  // =========================================================================
  {
    id: 0,
    doorNumber: 1,
    roundId: 1,
    type: "GENERAL",
    title: "SOLAR NAVIGATOR",
    desc: "GENERAL KNOWLEDGE — THE RIFT NAVIGATION CHART DEMANDS AN ANSWER.",
    content: `<p>RIFT NAVIGATION OFFICE — STELLAR REGISTRY FILE</p>
<pre>
The escape crew is charting a course out of the facility.
The nav computer requests a readout from the stellar registry.

STANDING ORDER (FAC-70R): Identify the body that dominates
the center of OUR solar system — the primary gravitational
anchor around which everything else orbits.
</pre>
<p>
Note: This is the single largest object in our system with
massive enough pull that planets, asteroids and comets all
fall in line around it.
</p>
<p>Provide the answer as a single word.</p>`,
    answer: "SUN",
    acceptedAnswers: ["SUN", "THE SUN"],
    hint: "It rises in the east every morning and is the star at the heart of our solar system — not a planet.",
    fragment: "428",
  },
  {
    id: 1,
    doorNumber: 2,
    roundId: 1,
    type: "GENERAL",
    title: "THE RED ROCK",
    desc: "GENERAL KNOWLEDGE — FOURTH ROCK FROM THE SUN IDENTIFICATION.",
    content: `<p>DEEP SPACE TELEMETRY — PLANETARY SURVEY</p>
<pre>
The facility's telescope has locked onto a dusty, rust-colored
world that has fascinated explorers for centuries.

SUBJECT PROFILE:
- Fourth planet from the Sun
- Known for its iron-rich, reddish surface
- Home to the solar system's tallest volcano: Olympus Mons
- Often called the "Red Planet"
</pre>
<p>Provide the name of this planet as a single word.</p>`,
    answer: "MARS",
    acceptedAnswers: ["MARS"],
    hint: "Red Planet, fourth from the Sun, named after the Roman god of war.",
    fragment: "731",
  },
  {
    id: 2,
    doorNumber: 3,
    roundId: 1,
    type: "PATTERN",
    title: "FIBONACCI SEQUENCE",
    desc: "PATTERN RECOGNITION — PREDICT THE NEXT TERM IN THE NUMBER SERIES.",
    content: `<p>COMPUTATIONAL VAULT — NUMBER SERIES ANALYSIS</p>
<pre class="ciph">
1, 1, 2, 3, 5, 8, <span class="kw">???</span>
</pre>
<p>ANALYSIS GRID:</p>
<pre>
Each term after the first two is the SUM of the two before it.

  1           (seed)
  1           (seed)
  2  = 1 + 1
  3  = 1 + 2
  5  = 2 + 3
  8  = 3 + 5
 ???  = 5 + 8  = ?
</pre>
<p>Provide the next number in the sequence.</p>`,
    answer: "13",
    acceptedAnswers: ["13"],
    hint: "5 + 8 = 13. The Fibonacci sequence just keeps adding the previous two terms.",
    fragment: "195",
  },
  {
    id: 3,
    doorNumber: 4,
    roundId: 1,
    type: "PATTERN",
    title: "TRIANGULAR SERIES",
    desc: "PATTERN RECOGNITION — THE NEXT TERM IN THIS GROWING SERIES.",
    content: `<p>GEOMETRY BAFFLE — SEQUENCE ANALYSIS</p>
<pre class="ciph">
2, 6, 12, 20, 30, <span class="kw">???</span>
</pre>
<p>RECONSTRUCTION NOTES:</p>
<pre>
Term 1:   2  = 1 × 2
Term 2:   6  = 2 × 3
Term 3:  12  = 3 × 4
Term 4:  20  = 4 × 5
Term 5:  30  = 5 × 6
Term 6:  ??  = 6 × 7  = ?
</pre>
<p>Provide the next number in the sequence.</p>`,
    answer: "42",
    acceptedAnswers: ["42"],
    hint: "Each term is n × (n+1). Term 6: 6 × 7 = 42.",
    fragment: "604",
  },
  {
    id: 4,
    doorNumber: 5,
    roundId: 1,
    type: "CODE",
    title: "VARIABLE TRACE",
    desc: "CODE READING — TRACE THE VARIABLES AND READ THE FINAL OUTPUT.",
    content: `<p>FACILITY SCRIPT MODULE — READ THE OUTPUT</p>
<pre>
<span class="cmt"># Facility console script</span>
x = <span class="num">5</span>
x = x + <span class="num">3</span>
x = x * <span class="num">2</span>

<span class="fn">print</span>(x)
</pre>
<p>TRACE THE LINE-BY-LINE VALUES:</p>
<pre>
Line 1: x = 5
Line 2: x = 5 + 3 = 8
Line 3: x = 8 * 2 = ?
print(x) prints the final value.
</pre>
<p>Provide the number that gets printed.</p>`,
    answer: "16",
    acceptedAnswers: ["16"],
    hint: "5 + 3 = 8, then 8 × 2 = 16.",
    fragment: "382",
  },
  {
    id: 5,
    doorNumber: 6,
    roundId: 1,
    type: "CODE",
    title: "THE GREETING FUNCTION",
    desc: "CODE READING — DETERMINE WHAT THIS FUNCTION PRINTS.",
    content: `<p>FACILITY PROTOCOL LIBRARY — OUTPUT ANALYSIS</p>
<pre>
<span class="kw">def</span> <span class="fn">greet</span>(name):
    <span class="kw">return</span> <span class="str">"HELLO "</span> + name

<span class="fn">print</span>(<span class="fn">greet</span>(<span class="str">"TEAM"</span>))
</pre>
<p>EXECUTION NOTES:</p>
<pre>
greet("TEAM") runs the function with name = "TEAM".
The function returns "HELLO " + "TEAM".
print(...) displays that string on the console.

Type the EXACT string that appears on screen
(including the space and the capitalization).
</pre>
<p>Provide the printed output.</p>`,
    answer: "HELLO TEAM",
    acceptedAnswers: ["HELLO TEAM", "\"HELLO TEAM\""],
    hint: "\"HELLO \" + \"TEAM\" = \"HELLO TEAM\" — don't forget the space.",
    fragment: "917",
  },

  // =========================================================================
  // ROUND 02 — THE CORE INFILTRATION (Doors 07 - 12)
  // =========================================================================
  {
    id: 6,
    doorNumber: 7,
    roundId: 2,
    type: "GENERAL",
    title: "CONTINENTAL DRIFT",
    desc: "GENERAL KNOWLEDGE — THE ANCIENT SUPERCONTINENT RECONSTRUCTION.",
    content: `<p>SECTOR 02 GEOLOGICAL SURVEY — TECTONIC LOG</p>
<pre>
The facility deep vaults sit embedded in ancient bedrock.
Before the modern continents drifted apart across the mantle,
all global landmasses were joined into a colossal single supercontinent.

CLINICAL LOG:
- Existed during late Paleozoic and early Mesozoic eras
- Assembled from earlier continental units ~335 million years ago
- Began to break apart ~175 million years ago
</pre>
<p>Provide the name of this supercontinent as a single word.</p>`,
    answer: "PANGEA",
    acceptedAnswers: ["PANGEA", "PANGAEA"],
    hint: "Sounds like 'pan-GEE-uh' — meaning 'all Earth' in ancient Greek.",
    fragment: "513",
  },
  {
    id: 7,
    doorNumber: 8,
    roundId: 2,
    type: "GENERAL",
    title: "THE INVISIBLE FORCE",
    desc: "GENERAL KNOWLEDGE — THE PRIMARY UNIVERSAL ATTRACTOR.",
    content: `<p>SUB-LEVEL 04 GRAVIMETRIC TELEMETRY</p>
<pre>
The station stabilization thrusters calibrate against
a fundamental physical interaction.

FORCE CHARACTERISTICS:
- Keeps planets in stable orbits around stellar anchors
- Keeps physical mass bound to terrestrial surfaces
- Weakest of the four fundamental interactions, but infinite in range
- Described universally by Newton and Einstein
</pre>
<p>Provide the name of this force as a single word.</p>`,
    answer: "GRAVITY",
    acceptedAnswers: ["GRAVITY", "GRAVITATION"],
    hint: "The force that makes objects fall to Earth — Newton and the apple.",
    fragment: "842",
  },
  {
    id: 8,
    doorNumber: 9,
    roundId: 2,
    type: "PATTERN",
    title: "SQUARE ROOT SEQUENCE",
    desc: "PATTERN RECOGNITION — RADICAL POWER RESOLUTION.",
    content: `<p>NUMERICAL ARCHIVE — CORE CALCULATION</p>
<pre class="ciph">
√49 = <span class="kw">???</span>
</pre>
<p>MATHEMATICAL NOTES:</p>
<pre>
Find the positive integer which, when multiplied by itself,
produces exactly forty-nine:

  X × X = 49
</pre>
<p>Provide the single integer answer.</p>`,
    answer: "7",
    acceptedAnswers: ["7", "SEVEN"],
    hint: "7 × 7 = 49. The answer is 7.",
    fragment: "267",
  },
  {
    id: 9,
    doorNumber: 10,
    roundId: 2,
    type: "PATTERN",
    title: "THE BINARY CODE",
    desc: "PATTERN RECOGNITION — BASE-10 TO BASE-2 TRANSLATION.",
    content: `<p>DIGITAL CONDUIT INTERFACE — REGISTER TRANSLATION</p>
<pre class="ciph">
DECIMAL: 10  ===>  BINARY: <span class="kw">????</span>
</pre>
<p>REGISTER BIT POSITIONS:</p>
<pre>
Powers of 2:   [8]   [4]   [2]   [1]
Target: 10
  8 fits in 10?   YES  -> Bit = 1 (Remainder 2)
  4 fits in 2?    NO   -> Bit = 0
  2 fits in 2?    YES  -> Bit = 1 (Remainder 0)
  1 fits in 0?    NO   -> Bit = 0
</pre>
<p>Provide the 4-bit binary representation.</p>`,
    answer: "1010",
    acceptedAnswers: ["1010", "0b1010"],
    hint: "8 + 2 = 10. In binary powers: 1010.",
    fragment: "905",
  },
  {
    id: 10,
    doorNumber: 11,
    roundId: 2,
    type: "CODE",
    title: "THE LOOP COUNTER",
    desc: "CODE READING — ACCUMULATOR TRACE OVER ITERATION RANGE.",
    content: `<p>PROCESS SCHEDULER — RUNTIME ANALYSIS</p>
<pre>
<span class="cmt"># Accumulator loop</span>
total = <span class="num">0</span>
<span class="kw">for</span> i <span class="kw">in</span> <span class="fn">range</span>(<span class="num">1</span>, <span class="num">11</span>):
    total += i

<span class="fn">print</span>(total)
</pre>
<p>ANALYSIS:</p>
<pre>
range(1, 11) generates numbers 1, 2, 3, 4, 5, 6, 7, 8, 9, 10.
total sums all integers from 1 through 10.
Formula: n*(n + 1)/2 = 10*11/2.
</pre>
<p>Provide the final printed total.</p>`,
    answer: "55",
    acceptedAnswers: ["55"],
    hint: "1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 = 55.",
    fragment: "374",
  },
  {
    id: 11,
    doorNumber: 12,
    roundId: 2,
    type: "CODE",
    title: "THE ARRAY REVERSE",
    desc: "CODE READING — SLICE MANIPULATION OUTPUT.",
    content: `<p>BUFFER MODULE — REVERSE SLICE</p>
<pre>
<span class="cmt"># String inversion routine</span>
word = <span class="str">"HELLO"</span>
<span class="fn">print</span>(word[::<span class="num">-1</span>])
</pre>
<p>EXECUTION NOTES:</p>
<pre>
The slice notation [::-1] steps through the string
backwards from the last character to the first.
</pre>
<p>Provide the exact printed string.</p>`,
    answer: "OLLEH",
    acceptedAnswers: ["OLLEH", "\"OLLEH\""],
    hint: "'HELLO' reversed character-by-character is 'OLLEH'.",
    fragment: "689",
  },

  // =========================================================================
  // ROUND 03 — THE FINAL PROTOCOL (Doors 13 - 18)
  // =========================================================================
  {
    id: 12,
    doorNumber: 13,
    roundId: 3,
    type: "GENERAL",
    title: "THE DNA SPIRAL",
    desc: "GENERAL KNOWLEDGE — MOLECULAR ARCHITECTURE IDENTIFICATION.",
    content: `<p>BIO-CHAMBER 09 ARCHIVE — NUCLEIC ACID PROFILE</p>
<pre>
The facility genetic databank requests classification
of the fundamental geometric configuration of DNA.

PROFILE:
- Discovered by Watson, Crick, and Franklin in 1953
- Two complementary antiparallel strands of polynucleotides
- Shaped like a winding, twisted ribbon ladder
</pre>
<p>Provide the scientific name for this spiral geometry as a single word.</p>`,
    answer: "HELIX",
    acceptedAnswers: ["HELIX", "DOUBLE HELIX"],
    hint: "From the ancient Greek word for 'twisted' or 'spiral' — a double HELIX.",
    fragment: "624",
  },
  {
    id: 13,
    doorNumber: 14,
    roundId: 3,
    type: "GENERAL",
    title: "SPEED OF LIGHT",
    desc: "GENERAL KNOWLEDGE — UNIVERSAL VELOCITY CONSTANT.",
    content: `<p>QUANTUM SENSOR SUITE — VACUUM CONSTANTS</p>
<pre>
The facility laser communication link requires synchronization
with the speed of light in vacuum (c).

SPECIFICATION:
- Universal physical constant
- Speed of massless particles in vacuum
- Expressed in km/s as a 6-digit integer starting with 299...
</pre>
<p>Provide the speed of light in km/s (rounded to the nearest whole integer).</p>`,
    answer: "299792",
    acceptedAnswers: ["299792", "299,792"],
    hint: "299,792 km per second — exactly 299792.",
    fragment: "189",
  },
  {
    id: 14,
    doorNumber: 15,
    roundId: 3,
    type: "PATTERN",
    title: "THE PRIME SEQUENCE",
    desc: "PATTERN RECOGNITION — SUBSEQUENT PRIME INTEGER DETERMINATION.",
    content: `<p>CRYPTOGRAPHIC CIPHER ENGINE — PRIME FILTER</p>
<pre class="ciph">
83, 89, <span class="kw">???</span>
</pre>
<p>REPRESENTATION:</p>
<pre>
Identify the next prime number strictly greater than 89.
  90 is divisible by 2, 3, 5
  91 is divisible by 7 (7 × 13)
  92 is divisible by 2
  93 is divisible by 3 (3 × 31)
  94 is divisible by 2
  95 is divisible by 5
  96 is divisible by 2
  97 ... ?
</pre>
<p>Provide the next prime number.</p>`,
    answer: "97",
    acceptedAnswers: ["97"],
    hint: "97 has no divisors other than 1 and itself.",
    fragment: "753",
  },
  {
    id: 15,
    doorNumber: 16,
    roundId: 3,
    type: "PATTERN",
    title: "THE GOLDEN RATIO",
    desc: "PATTERN RECOGNITION — DIVINE PROPORTION INTEGER SCALING.",
    content: `<p>STRUCTURAL HARMONIC ANALYZER — GOLDEN CUT</p>
<pre class="ciph">
φ = (1 + √5) / 2 ≈ 1.6180339887...
</pre>
<p>REQUIREMENT:</p>
<pre>
Take the mathematical Golden Ratio constant (φ).
Multiply it by exactly 1000 and round to the nearest whole integer:

  1.6180339887 × 1000 = ?
</pre>
<p>Provide the 4-digit rounded integer.</p>`,
    answer: "1618",
    acceptedAnswers: ["1618"],
    hint: "1.618... × 1000 = 1618.",
    fragment: "802",
  },
  {
    id: 16,
    doorNumber: 17,
    roundId: 3,
    type: "CODE",
    title: "THE RECURSIVE FUNCTION",
    desc: "CODE READING — STACK TRACE OF FACTORIAL CALCULATION.",
    content: `<p>MAINFRAME RECURSION CORE — CALL STACK</p>
<pre>
<span class="kw">def</span> <span class="fn">factorial</span>(n):
    <span class="kw">if</span> n &lt;= <span class="num">1</span>:
        <span class="kw">return</span> <span class="num">1</span>
    <span class="kw">return</span> n * <span class="fn">factorial</span>(n - <span class="num">1</span>)

<span class="fn">print</span>(<span class="fn">factorial</span>(<span class="num">5</span>))
</pre>
<p>EVALUATION:</p>
<pre>
5! = 5 × 4 × 3 × 2 × 1
</pre>
<p>Provide the final printed number.</p>`,
    answer: "120",
    acceptedAnswers: ["120"],
    hint: "5 × 4 × 3 × 2 × 1 = 120.",
    fragment: "346",
  },
  {
    id: 17,
    doorNumber: 18,
    roundId: 3,
    type: "CODE",
    title: "THE HASH MAP",
    desc: "CODE READING — DATA STRUCTURE KEYING PARADIGM.",
    content: `<p>DATABASE ENGINE — LOOKUP TABLE SPECIFICATION</p>
<pre>
In associative arrays, dictionaries, and hash tables,
data is organized as pairs composed of a unique identifier
and its associated data element.
</pre>
<p>QUESTION:</p>
<pre>
What is the standard two-word term for this pairing?
Format: WORD1-WORD2 (or with a space).
Hint: Each entry binds a ____ to a ____.
</pre>
<p>Provide the two-word term.</p>`,
    answer: "KEY-VALUE",
    acceptedAnswers: ["KEY-VALUE", "KEY VALUE", "KEYVALUE"],
    hint: "Every lookup maps a KEY to a VALUE -> 'KEY-VALUE'.",
    fragment: "915",
  },
];

// Reusable getter helpers
export function getPuzzlesForRound(round: 1 | 2 | 3): Puzzle[] {
  const cfg = ROUNDS_CONFIG[round];
  return ALL_PUZZLES.slice(cfg.doorRange[0] - 1, cfg.doorRange[1]);
}

// Backwards compatibility alias for existing code
export const PUZZLES = ALL_PUZZLES.slice(0, 6);
export const MASTER_KEY_ORDER = ROUNDS_CONFIG[1].masterKeyOrder;
export const MASTER_ANSWER = "PERIMETER BREACH COMPLETE";
export const ROUND_LABEL = ROUNDS_CONFIG[1].subtitle;