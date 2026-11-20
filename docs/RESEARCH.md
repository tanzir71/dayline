<!-- Exported from the Claude doc "Seva v2 — Research & Product Concept" (https://claude.ai/artifact/2SMw5RhDr2nWtZnbJ1E1jJ) on 2026-11-20. The doc is the living version; this copy is for Claude Code, which cannot open claude.ai links. Two diagrams are replaced by placeholders. -->

> **Superseded in parts.** This research predates the decision to drop accounts, sync, share links, the care circle and the community. Dayline now keeps data only on the phone and shares by show mode or PDF. Where this differs from `docs/MILESTONES.md`, `docs/PRODUCT.md` or `docs/ARCHITECTURE.md`, those win.

# Seva v2 — Research & Product Concept

Nov 20, 2026 · @Tanzir

## Summary

Seva v2 (renamed Dayline below) should be a shared, local-first record of a child's day. Anyone caring for the child can add to it in seconds. It marks every change (a new medicine, a dose change, a bad night, a new sitter) and checks honestly whether that change made a difference. It ships as one web codebase: an installable PWA, the same app on desktop, and a local SQLite database that syncs through Supabase.

The concept makes three bets:

1. **Useful before the first log.** A knowledge base of guides, "Help now" for live hard moments, medicine reminders and a one-time child profile all work with zero data. Assume nobody logs; collect data as a side effect of things parents already do.
2. **Changes, not charts.** Medicine starts, dose changes, stops, new therapies and routine shifts are logged as *changes* with a review date. The app compares the weeks before and after, and drafts the summary the prescriber needs. This is the practical form of "automated detection".
3. **The handoff is the product.** Whoever is with the child (other parent, grandparent, sitter, teacher) gets a 30-second brief: sleep, doses, food, watch-fors, what calms. They can log without installing anything.
4. **Parents teach parents, with structure.** Tips are short cards: situation, what we tried, what happened. Other parents mark "tried it" with an outcome, and tips that work move into the child's own playbook. No open forum and no medication advice in v1.

Everything ships in milestones, and each one is a working release on GitHub Pages. The first is a landing page plus the guides, with no accounts and no data.

The v1 Figma gets quick logging, reminders and sharing right. v2 drops the clinician triage dashboard and emoji-mood logging. It adds event logging, a change-annotated timeline, and summaries shaped for each audience. The section "The new concept" lists each change from v1.

## Name and brand

**Name: Dayline.** One shared line for the child's day. It names the product's core object: the timeline every caregiver adds to, and that every brief and report is built from. Plain English, two syllables, easy to say in Bangla and English, and neither a person's name nor a medical word.

**Name check.** "Dayline" is already used by three App Store apps: a visual daily planner ([Softmatic](https://softmatic.com/manual/dayline/index.html)), a one-line diary ([Dayline - A Line for a Day](https://apps.apple.com/be/app/dayline-a-line-for-a-day/id6751871091)), and an iPhone health-summary app ([Dayline AI](https://apps.apple.com/app/id6757165886)). The last is in the health category, so the store name should carry a qualifier, such as "Dayline: Autism Care Log", and a trademark search is needed before launch.

Against competitors, Dayline is the only name that says what the product is. Nello, Moonbow, Tend and Intuitus are soft, abstract names; Guiding Growth and Tantrum Tracker describe the category rather than the product.

**Tagline:** Every day, on one line. Supporting lines: "Fewer surprises, together." and "See the day. Share the day." A native copywriter should write the Bangla lines rather than translating these.

| Considered | The idea | Why set aside |
| --- | --- | --- |
| Seva, Bindu | Care; a dot that joins others | Read as personal names |
| Cairn | Trail markers that guide the next walker | Pronunciation unclear to many |
| Almanac | A record that forecasts the next day | Feels old-fashioned |
| Lantern | Lights the next step | Very common; hard to own |
| Tidewise, Waymark | Tides; trail marks | Already used by a tide app and a care-team company |

**Logo.** A lowercase wordmark, "dayline", with a thin horizon line under it. A small marigold dot sits on the line at the right: "now". The app icon is the same line on Monsoon teal with three dots on it, the last one marigold. It mirrors the Today timeline, so the brand and the main screen look like the same thing.

**Palette.** A cool mist ground, deep teal, and one marigold "now" dot; never alarm-red. Colour always means the same kind of moment across the app, so a caregiver can read a day at a glance. These are set up as the "Dayline" colour variables in Figma.

| Role | Name | Hex | Used for |
| --- | --- | --- | --- |
| Background | Mist | #F3F6F5 | App background |
| Text | Ink | #12282C | Body text, icons |
| Primary | Monsoon | #1A5F5A | Buttons, navigation, brand |
| Accent | Marigold | #F2A93B | The "now" dot and new insights only |
| Hard moment | Ember | #D9622B | Meltdowns and hard moments |
| Win | Leaf | #2F8F5B | Wins, calm stretches |
| Sleep | Dusk | #5B54B8 | Sleep and night |
| Medicine | River | #2575AE | Doses and medicine changes |
| Food and gut | Wheat | #A57A1F | Meals, bathroom |

**Type.** Bricolage Grotesque for headings and big numbers. Figtree for interface text. Hind Siliguri for Bangla, sized to match Figtree. All three are free Google Fonts and are set up as "Dayline/" text styles in Figma.

**Voice.** Plain, calm and strengths-based. Use the parent's words: "child", "hard moment" (or "meltdown" if that is their word), "win", "what helps", "change". Avoid "patient", "episode", "non-compliant" and v1's "patients performing poorly". Patterns are described as "seen 6 of 8 times", never "X causes Y".

**Design files.** The brand sheet, 23 colour variables, 12 text styles, six components and seven screens are in the SEVA Design Figma file: [v2 · Dayline — Screens](https://www.figma.com/design/hWA0tZUaRY535kNq6NZu09/SEVA-Design?node-id=2519-4106) and [v2 · Dayline — Foundations](https://www.figma.com/design/hWA0tZUaRY535kNq6NZu09/SEVA-Design?node-id=2519-4107). The v1 screens are kept, grouped by flow, on the v1 pages.

## The problem, restated

A change in behavior usually has several possible causes at once, and the people who see each cause never see the whole picture. Parents end up as the only link between home, school, sitters and several doctors, holding it all in memory.

**Many overlapping drivers.** In a UC Davis study of 255 autistic preschoolers, nearly half had frequent GI symptoms versus under a fifth of controls, and more GI symptoms went with shorter sleep and more self-injury ([UC Davis](https://health.ucdavis.edu/health-news/research/gi-symptoms-linked-to-behavioral-problems-in-children-especially-those-with-autism/2020/08), [autism.org summary](https://autism.org/more-evidence-of-gi-issues-reported-in-kids-with-asd/)). A 2023 study found sleep problems tracked with aggression, more strongly in children with mealtime difficulties ([Children, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9955415)). The two FDA-approved medicines for irritability, risperidone and aripiprazole, list sedation, appetite and weight gain, and constipation among common side effects ([AJP Residents' Journal](https://psychiatryonline.org/doi/10.1176/appi.ajp-rj.2017.120902)). Sleep disturbance and irritability are listed too ([Raising Children Network](https://raisingchildren.net.au/autism/therapies-services/therapies-interventions/medications-asd)). So a hard week after a dose change could be the medicine, the sleep or the gut.

**Many hands, many prescribers.** Among 33,565 insured autistic children, 35% were on two or more psychotropic classes at once and 15% on three or more ([Spencer et al., Pediatrics 2013](https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/Psychotropic-Medication-Use-and-Polypharmacy-in/991019168758504721)). A child can have ten or more professionals around them ([WRAL](https://www.wral.com/amp/new-website-offers-private-social-network-for-families-individuals-with-autism/13434593/)). Many autistic children, even verbal ones, do not tell parents about their school day ([Pathfinders for Autism](https://pathfindersforautism.org/?p=596)), and events at school and home affect each other ([Vanderbilt TRIAD](https://vkc.vumc.org/assets/files/triad/tips/Home_Sch_Bx_Collaboration.pdf)).

**Parents carry it alone.** Studies of Bangladeshi families describe stigma, too few services (especially outside cities) and high distress, especially for mothers ([The Family Journal review](https://ifp.nyu.edu/2025/journal-article-abstracts/10664807251322169/), [Uddin & Ashrafun 2023](https://link.springer.com/10.1186/s41257-023-00089-w)). Parent-to-parent support is a growing answer: a scoping review found 25 studies of it, and a randomized trial tested a parent-mentor program after diagnosis ([scoping review](https://aminer.org/pub/63b558cc90e50fcafd745e82/parent-to-parent-support-among-parents-of-children-with-autism-a-review), [Moody et al.](https://digitalcommons.du.edu/psychology_faculty/97)).

What families need, in order:

1. Capture by anyone who is with the child, in seconds, including people without an account.
2. One timeline where medicines, sleep, gut, routine and school sit side by side, with every change marked.
3. Honest hints about what tends to come before hard days, with the evidence shown.
4. Summaries shaped for each reader: a sitter, a teacher, each prescriber.
5. Practical know-how from other parents, kept separate from the child's private record.

## What exists today

The space is busy with behavior loggers, and the newest ones already do ABC logging, PDF reports and care circles well. None we found treats medicine and routine changes as things to review, builds a brief for whoever is with the child right now, or ties parent tips to a child's own record. Five of the newest trackers ship for iPhone or iPad; only Nello adds a browser version.

| Product | What it does well | What it leaves open |
| --- | --- | --- |
| [Nello](https://apps.apple.com/bf/app/id6784738384) | Quick ABC logging; works offline with no account; on-device pattern insights; a "calm kit"; teachers can log through a web form with no app; advocate PDF. $3.99/month | Apple-first (plus browser); 90 days of history on the free tier |
| [Moonbow](https://apps.apple.com/us/app/id6764191923) | AI turns a spoken or typed vent into ABC notes; a Prepare tab for outings and transitions; Care Circle; PDFs for IEP and therapy. $8.99/month | iPhone/iPad; privacy label lists health data linked to identity |
| [Tend](https://apps.apple.com/app/id6775020286) | Check-ins, incidents, medicines, photos and follow-ups, kept on-device, with PDF reports | iPhone only; no shared record |
| [Guiding Growth](https://apps.apple.com/us/app/id6451050396) | Behavior, sleep, food diary, screen time, medicine and therapy in one place | iPhone only |
| [Tantrum Tracker](https://apps.apple.com/app/id609839725) | Detailed incident fields: place, causes, responses, what helped | A reviewer notes one behavior per episode, when episodes can run hours |
| [Trayt](https://www.mobihealthnews.com/news/trayts-new-app-help-people-neurodevelopmental-disorders-track-symptoms) | Web platform with separate parent, physician and therapist views | Clinic-oriented; heavier to adopt |
| [Bearable](https://bearable.app/support/howto/the-factor-effect-report/) (general) | "Factor effect" reports that compare days with and without a factor; needs at least 3 of each ([how](https://bearable.app/support-archive/page/7/)) | Built for self-tracking adults, not caregivers |
| [MyAutismTeam](https://prnewswire.com/news-releases/myautismteam-launches-first-social-network-dedicated-to-parents-of-children-with-autism-135089473.html) | Parent social network plus local provider recommendations | Open feed; not tied to any record |
| [PatientsLikeMe](https://support.patientslikeme.com/hc/en-us/articles/20005003075355-How-do-I-discuss-my-treatments-with-the-community) | Structured treatment evaluations that members can compare and aggregate | Adult chronic conditions; for-profit data model |
| [NHS autism health passport](https://www.autism.org.uk/health-passport) | A short profile of communication, pain, distress and calming needs for hospital staff | Paper or PDF; goes stale |
| Home-school log | Daily notes between teacher and parent, a long-standing classroom practice ([NYU Nest](https://docs.steinhardt.nyu.edu/pdfs/metrocenter/asdnest/CH_2/PP_Home_School_Connection_2013.pdf)) | Paper or generic class apps; not linked to home data |

What we should borrow: Nello's no-account teacher form and local-first stance, Moonbow's voice-to-ABC capture, Bearable's "with vs without" comparisons and minimum-data rule, PatientsLikeMe's structured outcomes, and the NHS passport's one-page format.

The gaps Dayline can own:

- Medicine and routine **changes as experiments**, each with a before-and-after review.
- A **handoff brief** for whoever is with the child now.
- **Android, desktop and web** from one codebase, at a price that works in Bangladesh.
- **Peer tips tied to the child's playbook**, with outcomes, instead of a feed.
- **Bangla and English** from day one.

## Benchmark against the closest competitors

Against the four closest autism-family apps, Dayline's plan is the only one that combines medicine reminders, change reviews, a handoff brief, no-account caregiver logging, Android and web, and Bangla. Nello is closest on logging and sharing; Guiding Growth is closest on medicines and voice. Cells come from each app's App Store listing as of November 2026; "—" means the listing doesn't mention it, not that it is certainly missing.

| Capability | Dayline (plan) | [Nello](https://apps.apple.com/bf/app/id6784738384) | [Moonbow](https://apps.apple.com/us/app/id6764191923) | [Tend](https://apps.apple.com/app/id6775020286) | [Guiding Growth](https://apps.apple.com/us/app/id6451050396) |
| --- | --- | --- | --- | --- | --- |
| Platforms | Android, iPhone, desktop, web | iPhone, iPad, web | iPhone, iPad, Watch | iPhone | iPhone |
| Paid tier (USD) | Open question | $3.99/mo, $19.99/yr, $39.99 lifetime | $8.99/mo, $49.99/yr | $4.99/wk, $29.99/yr, $59.99 lifetime | From $9.99/mo or $79.99/yr |
| Quick behavior log | Yes, ABC optional | Yes, ABC | Yes, AI turns notes into ABC | Yes | Yes |
| Voice capture | Later | Via Siri | Yes | — | Yes, AI |
| Sleep and food or gut | Yes | Yes | — | Sleep, appetite | Yes |
| Medicine reminders and dose log | Yes | — | — | Yes | Yes |
| Before-and-after review of changes | Yes, every medicine and routine change | — | — | — | After new therapies |
| Pattern insights | Yes, on device | Paid, on device | Yes | Paid | Yes |
| Shared record | Roles with expiry | Yes, free | Paid | PDF export only | Yes |
| Logging with no account | Sitter, school, clinician links | Teacher web form | — | — | — |
| Brief for the next caregiver | Yes | Calm kit only | — | — | — |
| Doctor or IEP report | One per prescriber | Paid FBA and advocate PDFs | Paid PDF | PDF | Smart Summaries |
| Offline, data on device | Yes, with sync | Yes | — | On device | — |
| Parent tips with outcomes | Yes | — | — | — | — |
| Languages | Bangla, English | English (claims nine) | English, Spanish, Chinese | English | English |

**Where competitors are ahead today:** all four have shipped. Moonbow's AI capture and clinician sync, Nello's free sharing and calm kit, and Guiding Growth's photo meal analysis and article library are things Dayline would only match later, if at all.

**Where Dayline can lead:** change reviews, the handoff brief, expiring links for sitters, schools and clinicians, Android and desktop, Bangla, and tips with outcomes. Every competitor charges a US-dollar subscription; a free core is the clearest way to win families in Bangladesh.

## What research says about triggers and detection

The signals worth automating first are the cheap, everyday ones: doses, sleep, gut, routine and who was caring. Wearables that predict a meltdown minutes ahead are real but still a research setting, so they belong on a later track.

**Wearables are promising, not ready.** In 2019, a wrist sensor (heart rate, skin conductance, temperature, motion) predicted aggression one minute ahead from three minutes of data in 20 minimally verbal youths. Accuracy was AUC 0.71 for a shared model and 0.84 for per-child models ([Goodwin et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC6988899), [Northeastern](https://news.northeastern.edu/2019/08/21/this-wearable-device-predicts-aggressive-outbursts-in-people-with-autism-a-minute-in-advance/)). A 2023 follow-up with 70 inpatients predicted aggression three minutes ahead at AUROC 0.80 ([JAMA Network Open](https://jamanetwork.com/journals/jamanetworkopen/article-abstract/2813185)). Of 86 enrolled, 8 would not wear the sensor ([PubMed](https://www.pubmed.gov/38127348/)). Two lessons carry over: per-child models beat shared ones, and some children will never wear a device.

**Sleep and gut are the strongest everyday signals.** Both are linked to behavior in several studies (see the problem section) and both take one or two taps to log.

**Medicines have known side-effect lists.** The openFDA label API returns each drug's label in sections, including adverse reactions ([openFDA](https://open.fda.gov/apis/drug/label/)). The app can check a new symptom against the labels of what the child takes and suggest raising it with the prescriber.

**Weather is a hypothesis, not a finding.** A classroom study of three autistic children found no link between behavior and pressure, humidity or temperature ([VanBuskirk & Simpson 2013](https://searchworks.jioinstitute.edu.in/articles/eric__EJ1015030)). A 2023 study of children with profound intellectual and multiple disabilities found low pressure and wind linked to more refusal ([Frontiers in Psychiatry](https://www.frontiersin.org/articles/10.3389/fpsyt.2023.1235582)). Weather costs nothing to collect, so collect it and let each child's own data decide.

**Transitions matter, but don't oversell fixes.** Visual schedules are widely recommended for predictability ([Indiana IIDC](https://iidc.indiana.edu/pages/transition-time-helping-individuals-on-the-autism-spectrum-move-successfully-from-one-activity-to-another)). A 2025 review found too little evidence that the schedule alone improves transitions ([Mouzakes & Thompson](https://digitalcommons.law.wne.edu/casfacpubs/10)). Log transitions as context; don't promise outcomes.

What Dayline can capture, and what it costs the parent:

| Signal | How it gets in | Parent effort | Phase |
| --- | --- | --- | --- |
| Time of day, weekday | Automatic | None | MVP |
| Who was caring | From the handoff and who logged | None | MVP |
| Doses given, late, missed, refused | Tap on the reminder | 1 tap | MVP |
| Medicine and routine changes | Entered once; review date set | Once per change | MVP |
| Sleep | Morning check-in: bedtime, wake, night wakings | 2 taps | MVP |
| Bowel movements and gut | One tap with a stool-type picker | 1 tap | MVP |
| Hard moments and wins | Quick log, optional ABC details or voice | 1 to 3 taps | MVP |
| School days, holidays, therapy, travel | Calendar feed import | None after setup | Next |
| Weather | Weather API by city | None | Next |
| Symptom vs medicine labels | openFDA label lookup | None | Next |
| Heart rate, skin conductance | Wearable through the Google Health API | Child must tolerate it | Research |

## The new concept

Dayline is a shared day record with three outputs: a brief for whoever is with the child now, a review for every change, and a report for each prescriber. Everything else serves those three.

**Principles**

1. **Ten-second capture.** One tap logs. Details are optional, can be added later, and can be spoken.
2. **Changes are first-class.** Every change has a start date, a reason, who decided, and a review date.
3. **Show the evidence.** Every pattern shows its counts. Nothing is shown until there is enough data.
4. **Brief whoever is next.** The handoff is generated, not written.
5. **Local-first, share on purpose.** Data lives on the device. Every share is scoped, time-limited, revocable and logged.
6. **Strengths, not deficits.** Wins and "what helps" are as visible as hard moments.
7. **Everyone in the circle can use it.** Android, iPhone, desktop or a plain link; Bangla and English; slow connections.

**The daily loop**

1. Morning check-in: how the night went and how the child seems. About ten seconds.
2. Through the day, anyone with the child logs hard moments, wins, doses, meals and bathroom.
3. At each handoff, the next caregiver opens the brief.
4. Overnight, the device updates the child's patterns.

**The longer loop**

1. A change review comes due: "Two weeks since melatonin moved to 7 pm. Here is before and after."
2. Before a visit, the prescriber gets a "since your last visit" report.
3. What helped goes into the child's playbook, next to tips other parents marked as working.

**What changes from v1**

| Area | v1 (Seva Figma) | v2 (Dayline) | Why |
| --- | --- | --- | --- |
| Logging | Emoji mood, Keep-style notes, photo/video | Events (hard moment, win, sleep, gut, dose) with optional ABC detail and voice; the mood check-in stays | Events carry time and context, so they can be linked to causes |
| Home | Dashboard of quick actions | "Today": the day in order, next doses, a watch-for card | A caregiver needs the day, not a menu |
| Insights | Charts of condition over time | Change reviews and "seen 6 of 8 times" patterns | Answers "did it help?" |
| Medicines | Reminders | Reminders, dose log, changes with review dates, label check | Changes are where confusion starts |
| Therapy | Google Calendar sync | Calendar feed import as context | Lighter setup; no write access to calendars |
| Doctor view | Patient list with "performing poorly" triage | A report per prescriber and a time-limited link | Doctors won't adopt another dashboard; a two-minute read fits a visit |
| Sharing | Access management | Care circle roles, no-account sitter link, school daily note | Matches who actually looks after the child |
| New | None | Handoff brief, About-me passport, parent tips, playbook | Gaps found in research |
| Language | "Patient" | "Child", strengths-based | Respect and trust |

## Useful with nothing logged

Design for the parent who forgets: Dayline must earn every open without any data, and collect data only as a side effect of things the parent already does. Retention is the norm to beat. Top-performing health apps keep about 15% of users at 30 days ([Wysa study](https://pmc.ncbi.nlm.nih.gov/articles/PMC9171603)). Across eight remote digital health studies with over 100,000 people, median retention was 5.5 days, and a clinician's referral added 40 days ([npj Digital Medicine](https://pmc.ncbi.nlm.nih.gov/articles/PMC7026051)). That last finding is a hint: the visit report and clinician links are retention features too.

**What works on day one, with zero logs**

1. **Guides, the knowledge base.** Everyday situations (haircut, dentist, Eid visits, travel, school start), medicines, sleep, gut and food, sensory needs, communication, school and rights, and services in Bangladesh. Bangla and English, offline, readable in two minutes, each with a named reviewer and date. A "For Rafi this week" strip picks guides from the child's profile and the calendar (Eid next week, a new medicine, exams).
2. **Help now.** One button during a hard moment: calm steps from the child's own playbook first, then general ones; a call button. Starting it timestamps the moment and ending it saves a hard-moment entry with what helped. The parent never "logs".
3. **About the child.** Five minutes, once: how they communicate, show pain, what calms, what to avoid, medicines, allergies, contacts. This alone powers the handoff brief and the hospital-style passport.
4. **Medicine reminders and refills.** Useful on their own. Each "given" tap is a dose log; a refill count warns before tablets run out.
5. **Visit prep from memory.** Sixty seconds of questions before an appointment (more, same or fewer hard moments; sleep; appetite; anything new) produces a report even with no logs, and better ones as data builds up.

**Logging as a side effect**

| The parent does this anyway | Dayline records |
| --- | --- |
| Taps "given" on a reminder | Dose time, who gave it |
| Uses Help now | A hard moment with start, end and what helped |
| Sends the handoff brief | Who is caring and from when |
| Teacher fills the daily note | The school day |
| Answers the weekly three-tap check-in | Rough sleep, mood and hard-moment level for the week |
| Answers "welcome back" after a gap | Changes they missed: new medicine, illness, school change |
| Imports the school or holiday calendar | Context: holidays, exams, travel |

**Coming back after weeks away.** No streaks, no guilt, no "you haven't logged". The app opens on today, and a short "welcome back" asks three yes/no questions about what changed. Patterns say how many days they rest on and simply wait for more.

**Nudges people won't mute.** Only real events: a dose is due, tablets are running low, a visit is in three days ("prep in 60 seconds"), or a routine change is coming from the calendar (Ramadan, Eid, school holidays) with the matching guide.

**One long-press away.** Installed PWAs on Android can show app shortcuts from the manifest on a long-press of the icon. Chrome on Android shows only the first three, so order matters ([web.dev](https://web.dev/learn/pwa/enhancements.md.txt)): Help now, Dose given, Log a moment. iOS doesn't support PWA shortcuts ([Progressier](https://progressier.com/pwa-capabilities/app-shortcuts)).

**Knowledge base rules**

- Every guide carries a reviewer (clinician or trained parent), a review date, its sources and a reading level. Drafts never ship.
- No unproven or harmful "cures", ever, and no dosing advice.
- Medicine pages are built from official label data (openFDA) plus local brand names, framed as questions for the prescriber.
- The services directory starts with national bodies such as the Neuro-Developmental Disability Protection Trust under the Ministry of Social Welfare ([Wikipedia](https://en.wikipedia.org/wiki/Neuro-Developmental_Disability_Protection_Trust)) and IPNA at BSMMU. IPNA saw 14,142 new patients in 2022, and families report being turned away at busy times ([The Daily Star](https://www.thedailystar.net/node/3579956)). A "before your visit" guide is worth as much as the listing.
- Guides are static pages, so they work offline, load fast on slow networks, and can be shared to WhatsApp as plain links.

**Later: Ask Dayline.** Questions answered only from reviewed guides, with the guide linked, and a refusal for anything about doses.

## Feature set

The MVP is everything a family needs to run a week and walk into a doctor's visit prepared: capture, medicines, changes, the timeline, the handoff brief and the visit report. Pattern detection comes next, once families have a few weeks of data; community tips come after that.

| Feature | What it does | Used by | Phase |
| --- | --- | --- | --- |
| Quick log | Hard moment, win or note in one tap; optional intensity, duration, place, ABC detail, photo or voice | Everyone in the circle | MVP |
| Morning check-in | Bedtime, wake time, night wakings, how the child seems | Parents | MVP |
| Medicines | Schedule, reminders and a dose log: given, late, missed or refused, and by whom | Parents, sitters | MVP |
| Changes | Start, dose change, stop, new therapy or routine, with reason, who decided and a review date | Parents | MVP |
| Today timeline | The day in order, coloured by event type, with what's due next | Everyone | MVP |
| Handoff brief | Auto summary of sleep, doses, food, bathroom, mood so far, watch-fors and what calms; share by link, QR or print | Family, sitters | MVP |
| Sitter link | Log and see the brief with no account; expires automatically | Sitters, teachers | MVP |
| Playbook | What helps in each situation (haircut, car rides, bedtime), kept by the family | Everyone | MVP |
| About-me passport | One page on communication, pain, distress signs, calming, medicines and allergies, kept current | Hospitals, new people | MVP |
| Visit report | "Since your last visit" for one prescriber: changes, adherence, trends, side-effect questions; PDF and link | Doctors | MVP |
| Export and backup | Full CSV or JSON export; restore on a new device | Parents | MVP |
| Change reviews | Before-and-after comparison for each change, with overlapping changes flagged | Parents, doctors | Next |
| Patterns | With-vs-without comparisons, next-day effects, time-of-day map | Parents | Next |
| School daily note | Two-way note; the teacher logs during school hours | Teachers | Next |
| Context import | Calendar feeds (school, holidays, therapy) and local weather | Parents | Next |
| Label check | New symptoms checked against medicine labels, framed as a question for the prescriber | Parents, doctors | Next |
| Parent tips | Situation, what we tried, what happened; others mark "tried it" with an outcome | Parents | Later |
| Voice to ABC | Spoken note turned into structured fields for the parent to confirm | Parents | Later |
| Watch-for forecast | Heads-up for the next 24 hours from the child's own patterns | Everyone | Later |
| Clinician notes | A prescriber or therapist adds a note or a home-practice item back into the record | Clinicians | Later |
| Wearable signals | Heart rate and activity from a wearable, if the child tolerates one | Parents, researchers | Research |

Bangla and English interface text ships in the MVP; it is a requirement, not a feature.

## Pattern detection

"Automated detection" in Dayline means simple, explainable statistics on each child's own data, run on the device, with the evidence always one tap away. It starts with counting and comparing, and only adds a per-child model once there is enough history.

**How it works**

1. **Build a day table.** One row per day. Outcomes: number of hard moments, peak intensity, total minutes, wins. Factors: hours slept, night wakings, a day with no bowel movement, doses late or missed, school day, therapy day, number of transitions, who was caring, pressure change, and days since each active change.
2. **Compare with and without.** For each factor, compare outcomes on days with it and days without, the same day and one or two days later (a bad night shows up the next afternoon). Show nothing until there are at least 3 days of each, the floor Bearable uses ([Bearable](https://bearable.app/support-archive/page/7/)); we suggest 7 before a pattern appears on the home screen.
3. **Review each change.** Compare the two weeks before a change with the two weeks after, skipping the first few days. If another change started in that window, say so plainly: "Two changes overlapped, so we can't separate them."
4. **Map time of day.** A week-by-hour heat map of hard moments, with transitions and doses overlaid. This is often the first thing that helps: "most hard moments are 4 to 6 pm".
5. **Check medicine labels.** When a symptom appears after a medicine starts and it is listed on that medicine's label, show a card: "This is listed for X. Worth asking Dr. Y at the next visit."
6. **Forecast, later.** After roughly 30 logged hard moments, fit a small per-child model (logistic regression) on the same factors to give a next-day watch-for in the handoff brief. Per-child models did better than shared ones in the wearable studies.

**Guardrails**

- Wording is always "seen together", with counts: "After nights under 7 hours, 6 of 8 next days had a hard moment, versus 3 of 14 otherwise."
- Only the strongest few factors are shown, and a pattern must hold in two separate months before it is called "steady". This limits chance findings from testing many factors.
- Parents can mark a pattern "makes sense" or "not this"; that feedback hides or promotes it.
- No suggestion ever touches dosing. Medicine findings are framed as questions for the prescriber.
- The raw entries behind every pattern are one tap away.

**Where it runs.** In a Web Worker against the local SQLite database, so analysis needs no server and no child data leaves the device for it. Only the parent's chosen shares and the community's aggregate tip outcomes touch the server.

## Care circle and handoffs

Each person in the child's life gets exactly the slice they need, for as long as they need it, and every view is logged so parents can see who looked. The parent who created the child's record is always the owner and can revoke anything.

| Role | Sees | Can do | Access |
| --- | --- | --- | --- |
| Owner (parent) | Everything | Everything, including sharing and deleting | Account |
| Co-carer (other parent, grandparent) | Everything the owner chooses | Log, give doses, edit the playbook | Account |
| Sitter | Today's brief, the playbook, emergency contacts | Log, mark doses | Link or QR, expires (default 24 hours) |
| School | Brief at drop-off; the daily note | Log during school hours; write the daily note | Link per teacher, term-long |
| Clinician | The visit report and the timeline for the chosen period | Add a note or a home-practice item | Link per visit, expires (default 14 days) |

**The handoff brief** is one screen, generated, never typed. It shows:

- Sleep last night and how the morning went.
- Doses given today, and the next one due with its time and how to give it.
- Last meal and last bowel movement.
- Hard moments and wins so far today.
- Watch-fors: today's known risks, such as a short night, a missed dose or a schedule change.
- What calms, from the playbook, and who to call.

It works offline, prints on one page, and can be sent as a link in WhatsApp or SMS. The person opening it does not need the app.

**The school daily note** replaces the paper home-school notebook. The teacher taps how the day went in a few areas, adds a line, and can log a hard moment with its context. The parent replies on the same note. School entries land on the same timeline, so a hard evening can be read against a hard school afternoon.

**The visit report** is written for one prescriber and fits on two pages. It covers: changes since the last visit, including those made by other doctors; dose adherence; the trend in hard moments, sleep and gut; label-matched symptoms; and the parent's own questions. Showing other prescribers' changes is the point: with 35% of autistic children on two or more drug classes, no one doctor otherwise sees the full list.

**The About-me passport** follows the NHS autism health passport: how the child communicates, how they show pain and distress, what to avoid, what helps, medicines and allergies ([National Autistic Society](https://www.autism.org.uk/health-passport)). Dayline keeps the medicine and calming sections current from the record.

## Parent-to-parent tips

Tips work like PatientsLikeMe's treatment evaluations, applied to everyday strategies: short structured cards, rated by parents who tried them, and filtered to families like yours ([PatientsLikeMe](https://support.patientslikeme.com/hc/en-us/articles/20005003075355-How-do-I-discuss-my-treatments-with-the-community)). A tip can be saved into your own child's playbook, where Dayline tracks whether it works for your child.

**A tip card has four parts**

1. The situation: haircut, dentist, car rides, bedtime, school start, a wedding or Eid visit, new sibling.
2. What we tried, in a few lines.
3. What happened, and after how many tries.
4. Tags: age band, how the child communicates, sensory seeking or avoiding.

**"Tried it" closes the loop.** Any parent can mark a tip worked, partly worked or didn't, with an optional line. The card shows those counts, broken down for families like yours. When a parent saves a tip to their playbook and later logs that situation, Dayline asks how it went.

**Privacy by design**

- Posting is anonymous by default and fully separate from the child's record. Nothing from the record is ever shared unless the parent writes it into a tip.
- No photos or videos of children in tips.
- Names, schools, phone numbers and places are detected and blurred before posting.
- Breakdowns by family type appear only when 10 or more parents have answered, so no one can be singled out.

**Safety rules**

- In v1, tips cover everyday strategies only. No medicine tips. Any dose or drug name in a tip routes it to review.
- Tips can be reported. A small team of trained parent moderators reviews reports and new posters' first tips.
- Wording stays practical: "this worked for us", never "this cures" or "this will fix".
- The community area includes a link to support for caregivers themselves, since research in Bangladesh reports high stress and depression among parents.

**Not in v1:** an open feed, comments, direct messages, or a provider directory. Each adds a moderation load that a small team can't carry at launch. MyAutismTeam's provider recommendations are a good later model ([PR Newswire](https://prnewswire.com/news-releases/myautismteam-launches-first-social-network-dedicated-to-parents-of-children-with-autism-135089473.html)).

## Architecture

One web app, built as static files, runs everywhere: as a PWA on phones, installed on desktop, and as a plain link for sitters. Each device keeps a local SQLite database that PowerSync keeps in sync with Supabase Postgres, so the app works offline and every screen loads instantly.

&#91;embedded content: Dayline architecture · devices, sync, Supabase, outside services\]

Every device reads and writes its own SQLite copy. PowerSync carries changes to Supabase and back; Edge Functions handle push, share links, reports and outside lookups.

**Choices and why**

- **Front end.** A static single-page app (SvelteKit or React with Vite), a service worker for offline use, and a web app manifest for install. GitHub Actions builds and deploys it.
- **Hosting.** GitHub Pages is fine for the prototype and pilot. Two limits matter later. GitHub says Pages is not for commercial SaaS and should not carry sensitive transactions such as passwords ([GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). Pages also doesn't let you set custom response headers, which some browser storage modes need. So: passwordless sign-in from day one, and a move to a static host with headers and a custom domain before charging money.
- **Local database and sync.** PowerSync's web SDK runs SQLite in the browser and syncs it with Supabase Postgres. Reads and writes hit the local copy; sync runs in the background ([PowerSync docs](https://docs.powersync.com/integration-guides/supabase), [@powersync/web](https://www.npmjs.com/package/%40powersync%2Fweb)). Sync rules decide which rows each user's device receives ([Supabase](https://supabase.com/partners/catalog/powersync)). A sitter link gets a short-lived token scoped to one child and one day.
- **Supabase.** Auth (magic link, Google, phone code); Postgres with row-level security keyed on care-circle grants; Storage for photos in private buckets with signed URLs; Edge Functions for push, share links, PDF reports and label lookups; scheduled jobs for reminders.
- **No-account start.** A family can begin with local-only data and turn on sync later, as Nello does.
- **Notifications.** Web Push sent from an Edge Function. On iPhone, push only works once the app is added to the Home Screen (iOS 16.4 and later), and permission must be asked from a tap ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados)). Safari also revokes permission if a push arrives and isn't shown ([Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers.md)). Because a missed dose matters, also offer the medicine schedule as a calendar subscription, so the phone's own calendar alarms act as a backup.
- **Desktop.** The PWA installs from Chrome or Edge with no extra code. If we later need a tray icon, scheduled local backups or OS notifications without a browser, wrap the same build with Tauri 2, which uses the system webview and keeps apps small ([Tauri](https://v2.tauri.app/llms.txt)).
- **Wearables (research track).** The Fitbit Web API is being turned off in favour of the Google Health API, whose scopes are all restricted and need a privacy review ([Google](https://developers.google.com/health/about)). Apple Health is only reachable from a native app, so it would need a native wrapper.
- **AI (later).** Voice-to-ABC needs speech-to-text and a language model. Prefer on-device. If cloud, get explicit consent, use a provider with a data-processing agreement, and never send the child's name.

**First spike (before any feature work):** a PowerSync + Supabase PWA on GitHub Pages that works offline, survives a reload, syncs between two phones, and delivers a push to an iPhone from the Home Screen.

## Data model

One `event` table holds everything that happens to the child, so the timeline, patterns and reports all read from the same place. Medicines and changes get their own tables because they have schedules and review dates. Every row carries `child_id`, which is what row-level security and sync rules key on.

| Table | Key fields | Notes |
| --- | --- | --- |
| `child` | id, display name, birth month, language, time zone | Birth month, not full date, unless a report needs it |
| `circle_member` | child\_id, user\_id, role, scopes, expires\_at | Drives RLS and PowerSync sync rules |
| `share_link` | child\_id, token hash, role, scopes, expires\_at, revoked\_at | Sitter, school and clinician links |
| `event` | id, child\_id, type, started\_at, ended\_at, intensity, setting, antecedent, behavior, consequence, tags, logged\_by, source | Types: hard moment, win, sleep, meal, bowel, symptom, note, check-in, school note |
| `medication` | id, child\_id, name, label id, purpose, prescriber\_id | Label id links to openFDA |
| `dose_schedule` | medication\_id, times, amount, with food | Feeds reminders and the calendar feed |
| `dose_log` | schedule\_id, due\_at, given\_at, given\_by, status | Given, late, missed, refused |
| `change` | id, child\_id, kind, details, effective\_at, review\_at, decided\_by, reason | Medicine start, dose change, stop, therapy, diet, school, routine |
| `prescriber` | id, child\_id, name, specialty, contact | One report per prescriber |
| `day_context` | child\_id, date, weather, calendar flags | Filled by imports |
| `insight` | child\_id, factor, outcome, lag, counts with and without, computed\_at, status | Computed on device; status is new, makes sense, or not this |
| `playbook_item` | child\_id, situation, what helps, source tip id | A parent's own or saved from a tip |
| `passport` | child\_id, sections, updated\_at | Rendered to one page |
| `media` | event\_id, storage path, kind | Private bucket, signed URLs |
| `access_log` | child\_id, who, what, when | Shown to the owner |
| `tip` | id, pseudonym, situation tags, age band, text, status | Community; no link to `child` |
| `tip_outcome` | tip\_id, user\_id, result, note | Aggregated only above 10 answers |

Timestamps are stored in UTC with the child's time zone on `child`, so a dose at 8 am stays 8 am across devices.

## Privacy, safety and compliance

This is a child's health record, so the design defaults to the least sharing that still works. Where the data is stored is a legal decision as much as a technical one, and it needs a lawyer before launch. This section is a map of the questions, not legal advice.

**Product rules**

- Collect the minimum: birth month, not birth date; no address; photos only when the parent chooses.
- Every share is scoped, time-limited, revocable and shown in the access log.
- Full export and full delete, both self-serve.
- Analysis runs on the device. The server sees synced records, not inferences.
- Encrypt free-text notes and media on the device as a later step, once key sharing across the care circle is designed.
- Dayline is a record and a reminder, not a diagnostic tool. It never recommends doses or stopping a medicine, which also keeps it clear of medical-device claims.

**Bangladesh.** The Personal Data Protection Ordinance 2025 was gazetted in November 2025 and treats health data as sensitive ([The Daily Star](https://www.thedailystar.net/news/data-frontiers-where-does-bangladesh-fit-the-global-privacy-debate-4085556), [Prothom Alo](https://en.prothomalo.com/bangladesh/government/teeopu4dfv)). A law firm summary says it reaches services offered to people in Bangladesh from abroad, and that confidential and restricted data must be stored in Bangladesh ([Mahbub & Company](https://mahbub-law.com/key-highlights-of-the-personal-data-protection-ordinance-2025-for-businesses)). If that applies to Dayline's data, hosted Supabase in a nearby region may not be enough, and a self-hosted Supabase in a local data centre becomes the plan.

**United States.** A parent-facing app is usually not covered by HIPAA. The FTC's amended Health Breach Notification Rule, in force since July 29, 2024, explicitly covers health apps outside HIPAA and counts unauthorized disclosure as a breach ([FTC](https://www.ftc.gov/node/78112), [Federal Register](https://www.federalregister.gov/documents/2024/05/30/2024-10855/health-breach-notification-rule)). If clinics later use Dayline on behalf of patients, Supabase signs a BAA only on the Team plan or above with its HIPAA add-on ([summary](https://www.rapidevelopers.com/compliance/is-supabase-hipaa-compliant), [Supabase](https://supabase.com/docs/guides/platform/hipaa-projects)).

**Elsewhere.** In the EU and UK, a child's health data is special-category data under GDPR and needs explicit consent and a clear basis.

**Community safety.** Tips are anonymous and separate from records, medicine talk is excluded in v1, and identifying details are blurred before posting (see the tips section). The community area links to support for caregivers' own wellbeing.

## Roadmap and open questions

Ship in six milestones. Each one deploys to GitHub Pages from the main branch and is useful on its own, so families get value from M0 even if nothing after it ships. M0 to M2 keep all data on the phone. M3 adds accounts and sync only after the Bangladesh hosting question is settled. The gates are pilot targets: M1 ships once the M0 guides are reviewed, M2 once pilot families keep M1 for four weeks, and M3 once hosting is decided.

&#91;embedded content: Dayline milestones · six GitHub Pages releases, local-first until M3\]

Local-only milestones come first, so nothing waits on a backend. The Claude Code handoff in the abilities folder breaks each milestone into tasks with acceptance criteria.

**Open questions**

- [ ] First market: Bangladesh, the US, or both? This decides language, sign-in (phone codes cost money per message), hosting and law.
- [ ] Business model: free, freemium, NGO-run or clinic-sponsored? This decides when to leave GitHub Pages and whether a BAA is needed.
- [ ] Hosting: self-hosted Supabase in Bangladesh, or hosted Supabase in a nearby region? Needs a legal read of the 2025 ordinance.
- [ ] Clinicians: will they sign in, or only receive reports and links?
- [ ] Should v1 allow a no-account, local-only start?
- [ ] AI: on-device only, or cloud with explicit consent?
- [ ] Who moderates the tips, and in which languages?
- [ ] Is "Dayline" clear on trademark, given other apps use it, and which store qualifier do we add?

## Sources

**Existing products:** [Nello](https://apps.apple.com/bf/app/id6784738384) · [Moonbow](https://apps.apple.com/us/app/id6764191923) · [Tend](https://apps.apple.com/app/id6775020286) · [Guiding Growth](https://apps.apple.com/us/app/id6451050396) · [Tantrum Tracker](https://apps.apple.com/app/id609839725) · [Trayt](https://www.mobihealthnews.com/news/trayts-new-app-help-people-neurodevelopmental-disorders-track-symptoms) · [Bearable factor effect report](https://bearable.app/support/howto/the-factor-effect-report/) · [MyAutismTeam launch](https://prnewswire.com/news-releases/myautismteam-launches-first-social-network-dedicated-to-parents-of-children-with-autism-135089473.html) · [PatientsLikeMe evaluations](https://support.patientslikeme.com/hc/en-us/articles/20005003075355-How-do-I-discuss-my-treatments-with-the-community) · [NAS autism health passport](https://www.autism.org.uk/health-passport)

**Clinical research:** [GI symptoms and behavior, UC Davis 2020](https://health.ucdavis.edu/health-news/research/gi-symptoms-linked-to-behavioral-problems-in-children-especially-those-with-autism/2020/08) · [GI, sleep and challenging behavior, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9955415) · [FDA-approved medicines and side effects](https://psychiatryonline.org/doi/10.1176/appi.ajp-rj.2017.120902) · [Medicines for autistic children](https://raisingchildren.net.au/autism/therapies-services/therapies-interventions/medications-asd) · [Polypharmacy, Pediatrics 2013](https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/Psychotropic-Medication-Use-and-Polypharmacy-in/991019168758504721) · [Wearable prediction, 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6988899) · [Wearable prediction, JAMA Netw Open 2023](https://jamanetwork.com/journals/jamanetworkopen/article-abstract/2813185) · [Weather and behavior, 2013](https://searchworks.jioinstitute.edu.in/articles/eric__EJ1015030) · [Weather and behavior, 2023](https://www.frontiersin.org/articles/10.3389/fpsyt.2023.1235582) · [Visual schedules review, 2025](https://digitalcommons.law.wne.edu/casfacpubs/10)

**Families and support:** [Parents in Bangladesh, 2023](https://link.springer.com/10.1186/s41257-023-00089-w) · [Psychosocial challenges in Bangladesh](https://ifp.nyu.edu/2025/journal-article-abstracts/10664807251322169/) · [Parent-to-parent scoping review](https://aminer.org/pub/63b558cc90e50fcafd745e82/parent-to-parent-support-among-parents-of-children-with-autism-a-review) · [Parent mentorship trial](https://digitalcommons.du.edu/psychology_faculty/97) · [Home-school collaboration](https://vkc.vumc.org/assets/files/triad/tips/Home_Sch_Bx_Collaboration.pdf) · [Daily communication with teachers](https://pathfindersforautism.org/?p=596)

**Technology:** [PowerSync + Supabase](https://docs.powersync.com/integration-guides/supabase) · [@powersync/web](https://www.npmjs.com/package/%40powersync%2Fweb) · [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [Web Push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados) · [Apple web push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers.md) · [Tauri 2](https://v2.tauri.app/llms.txt) · [Google Health API](https://developers.google.com/health/about) · [openFDA drug labels](https://open.fda.gov/apis/drug/label/)

**Law and compliance:** [Bangladesh PDPO gazetted](https://www.thedailystar.net/news/data-frontiers-where-does-bangladesh-fit-the-global-privacy-debate-4085556) · [PDPO for businesses](https://mahbub-law.com/key-highlights-of-the-personal-data-protection-ordinance-2025-for-businesses) · [FTC Health Breach Notification Rule](https://www.ftc.gov/node/78112) · [Supabase HIPAA projects](https://supabase.com/docs/guides/platform/hipaa-projects)

**Design reference:** the Seva v1 Figma file (SEVA Design, onboarding through access management flows).
