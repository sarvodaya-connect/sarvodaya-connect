const sectors = [
  { label: "1 · Community Education & Mobilization", done: 540, plan: 600, color: "#e88b2d" },
  { label: "2 · Child Wellbeing & Protection", done: 410, plan: 450, color: "#39864a" },
  { label: "3 · Women Empowerment & Gender", done: 385, plan: 420, color: "#c72a69" },
  { label: "4 · New Economy – Youth, MSME, Social Protection", done: 470, plan: 560, color: "#28669a" },
  { label: "5 · Governance, Peace & Reconciliation", done: 210, plan: 260, color: "#7f4597" },
  { label: "6 · Health & Nutrition", done: 395, plan: 430, color: "#15887a" },
  { label: "7 · Disaster Response & Resilience", done: 180, plan: 200, color: "#315b8a" },
  { label: "8 · Technology & Infrastructure", done: 150, plan: 190, color: "#e88b2d" },
  { label: "9 · Agriculture & Food Security", done: 460, plan: 520, color: "#568b40" },
  { label: "10 · Environment & Climate Change", done: 260, plan: 300, color: "#39864a" },
];

const locationDots: [number, number, string][] = [
  [132, 35, "#39864a"], [121, 53, "#e1b619"], [145, 65, "#e88b2d"], [107, 84, "#e88b2d"], [136, 91, "#39864a"], [92, 110, "#e1b619"], [119, 119, "#e88b2d"], [151, 127, "#e88b2d"], [82, 143, "#39864a"], [111, 151, "#e88b2d"], [139, 161, "#e1b619"], [169, 173, "#e88b2d"], [73, 183, "#e88b2d"], [101, 193, "#39864a"], [130, 203, "#e88b2d"], [158, 211, "#e1b619"], [81, 226, "#e88b2d"], [111, 238, "#e88b2d"], [143, 246, "#39864a"], [172, 257, "#e88b2d"], [92, 268, "#e1b619"], [121, 278, "#e88b2d"], [150, 289, "#39864a"], [111, 303, "#e88b2d"], [134, 315, "#e1b619"],
];

function Card({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="rounded-xl border border-[#dfe5dc] bg-white p-4 shadow-sm sm:p-5"><h2 className="text-sm font-semibold text-[#28382f]">{title}</h2><div className="mt-4">{children}</div></section>;
}

export function NationalActivityBreakdown() {
  return <>
    <div className="flex flex-wrap items-baseline gap-2"><strong className="text-2xl font-bold text-[#174a32]">3,460</strong><span className="text-[10px] text-[#78857d]">of 3,930 planned activities done · 88%</span></div>
    <div aria-label="88 percent of planned activities completed" className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf0e8]" role="img"><span className="block h-full w-[88%] rounded-full bg-[#26744b]"/></div>
    <div className="mt-4 space-y-2">{sectors.map((sector) => <div className="grid grid-cols-[minmax(0,1fr)_68px_34px] items-center gap-2 text-[9px]" key={sector.label}><span className="truncate text-[#526057]">{sector.label}</span><span aria-label={`${sector.done} of ${sector.plan} complete`} className="h-1.5 overflow-hidden rounded-full bg-[#edf0e8]" role="img"><span className="block h-full rounded-full" style={{ width: `${sector.done / sector.plan * 100}%`, backgroundColor: sector.color }}/></span><strong className="text-right text-[#526057]">{sector.done} / {sector.plan}</strong></div>)}</div>
  </>;
}

export function NationalMapAndEmergency() {
  return <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.5fr]" id="national-section-7">
    <Card title="Society locations across Sri Lanka">
      <div className="relative overflow-hidden rounded-lg bg-[#d9edf8] p-3">
        <svg aria-label="Demonstration map of society locations across Sri Lanka" className="mx-auto h-[350px] max-w-full" role="img" viewBox="0 0 250 350">
          <path d="M125 12 112 22 102 21 96 32 83 38 79 50 68 57 75 68 62 76 56 90 61 101 49 113 44 127 53 140 43 153 46 169 36 181 43 197 34 211 43 224 40 239 49 252 51 268 60 280 63 295 75 306 82 321 94 329 106 342 118 337 128 326 138 321 148 310 159 302 166 288 178 279 180 263 190 252 189 236 198 223 192 207 198 193 191 179 195 166 185 153 183 138 172 126 174 112 164 101 158 88 150 76 151 61 144 52 145 39 137 31 137 20Z" fill="#f4f7ef" stroke="#8aa492" strokeWidth="1.5"/>
          <path d="M125 12 121 42M78 63 150 68M55 111 174 112M45 160 186 161M39 207 193 207M51 254 180 256M76 302 158 302" fill="none" stroke="#c4d1c6" strokeWidth="1"/>
          {locationDots.map(([cx, cy, fill], index) => <circle cx={cx} cy={cy} fill={fill} key={`${cx}-${cy}-${index}`} r="3.3" stroke="#fff" strokeWidth="1"/>)}
          <g fill="#526057" fontSize="7"><text x="97" y="57">JAFFNA</text><text x="104" y="112">VAVUNIYA</text><text x="61" y="171">KURUNEGALA</text><text x="114" y="199">KANDY</text><text x="159" y="232">BATTICALOA</text><text x="116" y="288">MONARAGALA</text><text x="82" y="323">GALLE</text></g>
        </svg>
        <div className="absolute bottom-3 right-3 rounded-md border border-[#dfe5dc] bg-white/95 p-2 text-[9px] shadow-sm"><strong className="block text-[#344239]">Society class</strong><p className="mt-1 text-[#526057]">● A · Strong</p><p className="text-[#526057]">● B · Developing</p><p className="text-[#526057]">● C · Needs strengthening</p></div>
      </div>
      <p className="mt-2 text-[10px] text-[#78857d]">Illustrative society locations · 25 district centres</p>
    </Card>
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Districts & pending actions"><div className="grid grid-cols-2 gap-3"><div><strong className="text-2xl text-[#23362b]">25</strong><p className="text-[10px] text-[#78857d]">District centres</p></div><div><strong className="text-2xl text-[#bd3f37]">37</strong><p className="text-[10px] text-[#78857d]">Pending HQ actions</p></div></div></Card>
      <Card title="Data verification"><ul className="space-y-3 text-[10px]">{[{ label: "Verified", count: "807", pct: "75%", color: "text-[#39864a]" }, { label: "Pending", count: "226", pct: "21%", color: "text-[#e1b619]" }, { label: "Incomplete", count: "43", pct: "4%", color: "text-[#c53b35]" }].map((item) => <li className="flex items-center gap-2" key={item.label}><span className={`${item.color} text-sm`}>●</span><span className="flex-1 text-[#526057]">{item.label}</span><strong className="text-[#344239]">{item.count}</strong><span className="w-8 text-right text-[#78857d]">{item.pct}</span></li>)}</ul></Card>
      <div className="sm:col-span-2"><Card title="Emergency / disaster status"><div className="grid gap-2 sm:grid-cols-2">{[{ value: "12", label: "Societies in affected areas", style: "bg-[#fbe9e4] text-[#a8402c]" }, { value: "4", label: "Active response programmes", style: "bg-[#e6f2f8] text-[#17628a]" }, { value: "8", label: "Relief deliveries in progress", style: "bg-[#e6f0e7] text-[#26744b]" }, { value: "26", label: "Societies requiring follow-up", style: "bg-[#fff4d6] text-[#806718]" }].map((item) => <div className={`rounded-lg p-3 ${item.style}`} key={item.label}><strong className="text-lg">{item.value}</strong><p className="text-[10px]">{item.label}</p></div>)}</div></Card></div>
    </div>
  </div>;
}
