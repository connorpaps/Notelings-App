# UI Implementation Prompts (Based on MotionSites.ai)

**INSTRUCTIONS FOR AI:**
When building the 2D UI for the Spatial "Second Brain" project, execute the two adapted MotionSites prompts below. 

**CRITICAL REQUIREMENT:** 
You are building an interface that floats OVER a 3D React Three Fiber `<Canvas>`. 
- The root containers must use `absolute inset-0 z-10 pointer-events-none` to allow the user to see the 3D robots underneath.
- Only interactive elements (buttons, inputs, glass cards) should have `pointer-events-auto`.
- Ignore any instructions in the original prompts that mention setting the `body` background to a solid color.

---

## 1. The Welcome / Loading Screen
**Theme Adaptation:** Adapted from "Digital Epoch Hero"
**Purpose:** This overlay greets the user and floats above the 3D office while the scene is initializing or waiting for login.

**Execution Prompt:**
Build a Hero Section overlay using React, Tailwind CSS v4, and Framer Motion.
- **Wrapper:** Instead of a solid background, use `absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center`. 
- **Content Container:** Use `motion.div` to fade in and slide up. Give it a subtle dark glass effect (`bg-black/30 backdrop-blur-md rounded-[48px] border border-white/10 p-12 pointer-events-auto`).
- **Typography:** Import `Inter` (sans) and `Outfit` (display). 
- **Headline:** "Spatial Second Brain". Use `Outfit`, size `text-[42px] md:text-[56px]`, medium weight, tight tracking, color `#FFFFFF`.
- **Subheadline:** "Your thoughts and tasks, managed by autonomous agents." Use `Inter`, size `text-[14px] md:text-[15px]`, color `#94A3B8`.
- **Primary Button:** "Initialize Agents". Use a dark background (`bg-[#0a152d]`), white text, rounded-full, with hover scale animations via `motion.button`.
- **Floating Bottom Navbar (The Command Dock):** 
  - Position an absolute navbar at the bottom center of the screen (`absolute bottom-10 left-1/2 -translate-x-1/2 z-30 pointer-events-auto`).
  - Use `motion.nav` to fade in. Classes: `flex items-center bg-black/50 backdrop-blur-2xl px-1.5 py-1.5 rounded-full shadow-lg border border-white/20`.
  - Add an `<input>` for the user to type new notes (text size 14px, transparent background, white text).
  - Add a "Submit" button with a `lucide-react` send icon, styled with `bg-white px-5 py-2 rounded-full text-[#0a1b33] font-semibold`.
  - *(Note: Do NOT include the background video or marquee scroller from the original Epoch prompt; the 3D scene replaces them).*

---

## 2. The Agent Status & Task Queue Panels
**Theme Adaptation:** Adapted from "Glow Features"
**Purpose:** Floating sidebar panels that display the live status of the 3D robots and the queue of submitted notes.

**Execution Prompt:**
Create a glowing feature panel overlay using React, Tailwind CSS v4, and Framer Motion.
- **Global Layout:** Create an absolute overlay: `absolute inset-0 z-10 pointer-events-none p-6 md:p-12 flex justify-between items-start`.
- **The Feature Card Component Requirements:**
  - Build a reusable `<AgentStatusCard />` component taking `title`, `state`, `icon`, `gradient`, and `delay`.
  - Wrap the entire card in a `<motion.div>` with `pointer-events-auto`.
  - Card size: `relative flex flex-col justify-start items-start w-[260px] md:w-[300px] group`.
  - **Glow Background (Crucial):** Create an absolute positioned `div` behind the card content with `w-full h-full opacity-60 rounded-[40px] pointer-events-none`. Apply inline styles: `background: gradient` and `filter: "blur(45px)"`.
  - **Foreground Card with Gradient Border (Crucial):** Create a relative container with `self-stretch rounded-[40px] z-10 overflow-hidden`. Apply an 8px solid transparent border.
  - Use the background-clip technique strictly for the border gradient via inline styles: `background: linear-gradient(#1A1A1C, #1A1A1C) padding-box, ${gradient} border-box;`
  - Content Inner Layout: Use `w-full p-7 flex flex-col justify-between`.
  - Icons: `size={32}` and `strokeWidth={2.5}`, `text-white/90`.
  - Titles: `text-white font-medium text-xl mb-1 tracking-tight`.
  - State/Description: `text-gray-400 text-[14px] leading-[1.6]`.

**Data for the Agent Cards (Left Side of Screen):**
Stack three of these cards vertically on the left side of the screen.
1. **Blue Agent (Librarian):**
   - Icon: `<BookOpen />` (lucide-react)
   - State: Linked to Zustand `blueAgent.state` (Idle/Active).
   - Gradient: `linear-gradient(137deg, #FFFFFF 0%, #7DD3FC 45%, #06B6D4 100%)`
2. **Green Agent (Archivist):**
   - Icon: `<Archive />` (lucide-react)
   - State: Linked to Zustand `greenAgent.state`
   - Gradient: `linear-gradient(137deg, #4ADE80 0%, #22C55E 45%, #166534 100%)`
3. **Red Agent (Security/Error):**
   - Icon: `<ShieldAlert />` (lucide-react)
   - State: Linked to Zustand `redAgent.state`
   - Gradient: `linear-gradient(137deg, #FF3D77 0%, #EF4444 45%, #991B1B 100%)`

**Task Queue Panel (Right Side of Screen):**
On the right side of the screen, render one large version of the `<AgentStatusCard />` component.
- Title: "Global Task Queue"
- Gradient: `linear-gradient(137deg, #4361EE 0%, #E0AEFF 45%, #F72585 100%)`
- Instead of a static description, render the list of pending notes from the Zustand `TaskQueue`. Use Framer Motion `<AnimatePresence>` so new notes slide into the list.