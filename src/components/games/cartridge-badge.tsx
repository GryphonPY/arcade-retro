import React from 'react'

export function CartridgeBadge({ gameId }: { gameId: string }) {
  switch (gameId) {
    case 'snake-neon':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Cyber Neon Grid */}
          <rect width="64" height="64" rx="8" fill="#090514" />
          <path d="M8 32 H56 M32 8 V56 M16 8 V56 M48 8 V56 M8 16 H56 M8 48 H56" stroke="#22c55e" strokeOpacity="0.15" strokeWidth="1" />
          {/* Neon Snake Body */}
          <path d="M14 46 H26 V30 H42 V18 H50" stroke="#22f7c5" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" style={{ filter: 'drop-shadow(0 0 4px #22f7c5)' }} />
          {/* Snake Eyes */}
          <rect x="46" y="16" width="3" height="3" fill="#090514" />
          {/* Food Neon Orb */}
          <circle cx="22" cy="18" r="5" fill="#f43f5e" style={{ filter: 'drop-shadow(0 0 6px #f43f5e)' }} />
          <circle cx="22" cy="18" r="2" fill="#fff" />
        </svg>
      )

    case 'space-invasion':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Starfield Space */}
          <rect width="64" height="64" rx="8" fill="#040614" />
          <circle cx="12" cy="14" r="1" fill="#fff" opacity="0.6" />
          <circle cx="50" cy="18" r="1.5" fill="#fff" opacity="0.8" />
          <circle cx="20" cy="48" r="1" fill="#fff" opacity="0.5" />
          {/* Red Mothership UFO */}
          <g fill="#f43f5e" style={{ filter: 'drop-shadow(0 0 4px #f43f5e)' }}>
            <rect x="24" y="12" width="16" height="4" rx="2" />
            <rect x="28" y="9" width="8" height="3" rx="1" fill="#fca5a5" />
          </g>
          {/* 8-bit Crab Invader */}
          <g fill="#5fe8de" style={{ filter: 'drop-shadow(0 0 5px #5fe8de)' }}>
            <rect x="26" y="24" width="12" height="12" />
            <rect x="20" y="27" width="24" height="6" />
            <rect x="18" y="24" width="4" height="4" />
            <rect x="42" y="24" width="4" height="4" />
            <rect x="22" y="33" width="4" height="6" />
            <rect x="38" y="33" width="4" height="6" />
            {/* Eyes */}
            <rect x="24" y="27" width="3" height="3" fill="#040614" />
            <rect x="37" y="27" width="3" height="3" fill="#040614" />
          </g>
          {/* Player Cannon Laser */}
          <line x1="32" y1="46" x2="32" y2="54" stroke="#22c55e" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 4px #22c55e)' }} />
        </svg>
      )

    case 'desert-runner':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Desert Sunset Sky */}
          <rect width="64" height="64" rx="8" fill="#fef08a" />
          {/* Blazing Red/Orange Sun */}
          <circle cx="44" cy="22" r="14" fill="#ea580c" />
          <circle cx="44" cy="22" r="10" fill="#f97316" />
          {/* Desert Sand Ground */}
          <rect x="0" y="44" width="64" height="20" fill="#d97706" />
          {/* Saguaro Cactus */}
          <g fill="#15803d">
            <rect x="46" y="30" width="6" height="18" rx="2" />
            <path d="M40 36 H46 V42 H40 Z M52 34 H46 V40 H52 Z" />
          </g>
          {/* Speed Armadillo Runner */}
          <g fill="#78350f">
            <ellipse cx="24" cy="40" rx="10" ry="7" />
            <circle cx="15" cy="41" r="4" />
            {/* Sunglasses */}
            <rect x="12" y="39" width="5" height="2" fill="#000" />
            {/* Running legs */}
            <rect x="18" y="46" width="3" height="4" />
            <rect x="27" y="46" width="3" height="4" />
          </g>
          {/* Dust clouds */}
          <circle cx="37" cy="45" r="3" fill="#fed7aa" opacity="0.8" />
          <circle cx="41" cy="43" r="2" fill="#fed7aa" opacity="0.6" />
        </svg>
      )

    case 'ghost-maze':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Arcade Dark Blue Maze */}
          <rect width="64" height="64" rx="8" fill="#08081a" />
          <rect x="8" y="8" width="48" height="48" rx="4" stroke="#2563eb" strokeWidth="2" />
          {/* Yellow Arcade Chomper */}
          <g fill="#facc15" style={{ filter: 'drop-shadow(0 0 6px #facc15)' }}>
            <path d="M22 32 A10 10 0 1 0 28 23 L20 32 Z" />
          </g>
          {/* Food Pellets */}
          <circle cx="32" cy="32" r="2.5" fill="#fef08a" />
          <circle cx="40" cy="32" r="2.5" fill="#fef08a" />
          {/* Blue Frightened Ghost */}
          <g fill="#38bdf8" style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }}>
            <path d="M48 24 A7 7 0 0 1 60 24 V36 L57 34 L54 36 L51 34 L48 36 Z" transform="translate(-4, 0)" />
            <rect x="47" y="23" width="2" height="3" fill="#fff" />
            <rect x="52" y="23" width="2" height="3" fill="#fff" />
          </g>
        </svg>
      )

    case 'traffic-racer':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Asphalt Highway */}
          <rect width="64" height="64" rx="8" fill="#18181b" />
          {/* Road Lines */}
          <line x1="32" y1="6" x2="32" y2="20" stroke="#facc15" strokeWidth="3" strokeDasharray="6 6" />
          <line x1="32" y1="30" x2="32" y2="58" stroke="#facc15" strokeWidth="3" strokeDasharray="6 6" />
          <line x1="10" y1="0" x2="10" y2="64" stroke="#fff" strokeWidth="2" opacity="0.3" />
          <line x1="54" y1="0" x2="54" y2="64" stroke="#fff" strokeWidth="2" opacity="0.3" />
          {/* Red Turbo Sports Car */}
          <g style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.7))' }}>
            <rect x="23" y="22" width="18" height="28" rx="4" fill="#dc2626" />
            {/* Windshield */}
            <rect x="25" y="28" width="14" height="7" rx="1" fill="#09090b" />
            {/* Rear window */}
            <rect x="26" y="42" width="12" height="3" fill="#09090b" />
            {/* Yellow Headlights Beam */}
            <polygon points="23,22 18,6 28,6 26,22" fill="#fef08a" opacity="0.4" />
            <polygon points="38,22 36,6 46,6 41,22" fill="#fef08a" opacity="0.4" />
            {/* Turbo Exhaust Flame */}
            <polygon points="26,50 28,58 30,50" fill="#38bdf8" />
            <polygon points="34,50 36,58 38,50" fill="#38bdf8" />
          </g>
        </svg>
      )

    case 'brick-breaker':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Prism Arcade Chamber */}
          <rect width="64" height="64" rx="8" fill="#111827" />
          {/* Pastel Bricks */}
          <rect x="10" y="12" width="12" height="6" rx="1" fill="#f43f5e" />
          <rect x="26" y="12" width="12" height="6" rx="1" fill="#f97316" />
          <rect x="42" y="12" width="12" height="6" rx="1" fill="#eab308" />
          <rect x="18" y="21" width="12" height="6" rx="1" fill="#10b981" />
          <rect x="34" y="21" width="12" height="6" rx="1" fill="#06b6d4" />
          {/* Glowing Bouncing Energy Ball */}
          <circle cx="28" cy="34" r="4.5" fill="#fff" style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }} />
          {/* Trajectory */}
          <line x1="28" y1="34" x2="34" y2="44" stroke="#38bdf8" strokeWidth="2" strokeDasharray="2 3" opacity="0.6" />
          {/* Neon Paddle */}
          <rect x="20" y="48" width="24" height="6" rx="3" fill="#38bdf8" style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }} />
        </svg>
      )

    case 'hit-and-run':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* City Street Night */}
          <rect width="64" height="64" rx="8" fill="#090914" />
          {/* Skid Marks */}
          <path d="M12 48 Q24 38 32 40" stroke="#000" strokeWidth="3" opacity="0.6" />
          <path d="M16 52 Q28 42 36 44" stroke="#000" strokeWidth="3" opacity="0.6" />
          {/* NYC Checkered Taxi */}
          <g transform="translate(4, -2) rotate(-8 28 32)">
            <rect x="18" y="22" width="22" height="30" rx="4" fill="#eab308" />
            <rect x="20" y="28" width="18" height="8" fill="#18181b" />
            {/* Checkered Roof Sign */}
            <rect x="24" y="38" width="10" height="4" fill="#fff" />
            <rect x="24" y="38" width="5" height="2" fill="#000" />
            <rect x="29" y="40" width="5" height="2" fill="#000" />
          </g>
          {/* Police Flashing Siren Red/Blue */}
          <circle cx="50" cy="16" r="6" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 8px #ef4444)' }} />
          <circle cx="42" cy="14" r="5" fill="#3b82f6" style={{ filter: 'drop-shadow(0 0 8px #3b82f6)' }} />
        </svg>
      )

    case 'gun-and-run':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Sunset Jungle Backdrop */}
          <rect width="64" height="64" rx="8" fill="#1c1008" />
          <path d="M0 48 Q20 38 36 44 Q50 40 64 48 V64 H0 Z" fill="#2d1607" />
          {/* Commando with Bandana & Gun */}
          <g>
            {/* Red Bandana */}
            <rect x="20" y="16" width="14" height="5" rx="1" fill="#dc2626" />
            <path d="M34 18 L42 16 L38 22 Z" fill="#dc2626" />
            {/* Face / Torso */}
            <rect x="22" y="21" width="10" height="8" fill="#fcd34d" />
            <rect x="18" y="29" width="16" height="14" rx="2" fill="#15803d" />
            {/* Heavy Blaster Machinegun */}
            <rect x="28" y="33" width="22" height="6" fill="#475569" />
            <rect x="28" y="39" width="5" height="7" fill="#1e293b" />
            {/* Muzzle Flash Fire */}
            <polygon points="50,32 60,36 50,40 54,36" fill="#facc15" style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }} />
          </g>
        </svg>
      )

    case 'asteroid-drift':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Deep Vector Void */}
          <rect width="64" height="64" rx="8" fill="#030712" />
          {/* Stars */}
          <circle cx="10" cy="18" r="1" fill="#fff" opacity="0.6" />
          <circle cx="54" cy="46" r="1" fill="#fff" opacity="0.6" />
          <circle cx="48" cy="12" r="1" fill="#fff" opacity="0.8" />
          {/* Vector Asteroids */}
          <polygon points="12,32 18,24 28,26 30,36 22,42 14,38" stroke="#38bdf8" strokeWidth="1.8" fill="none" style={{ filter: 'drop-shadow(0 0 4px #0ea5e9)' }} />
          <polygon points="46,18 52,14 58,20 54,28 44,24" stroke="#67e8f9" strokeWidth="1.5" fill="none" />
          {/* Vector Starfighter Ship */}
          <g transform="translate(32, 42) rotate(-45)">
            <polygon points="0,-14 9,10 0,6 -9,10" stroke="#38bdf8" strokeWidth="2" fill="#030712" style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }} />
            {/* Thruster Flame */}
            <polygon points="-4,7 0,16 4,7" fill="#f59e0b" />
          </g>
          {/* Twin Plasma Torpedoes */}
          <circle cx="36" cy="24" r="2" fill="#22d3ee" style={{ filter: 'drop-shadow(0 0 5px #22d3ee)' }} />
          <circle cx="42" cy="18" r="2" fill="#22d3ee" style={{ filter: 'drop-shadow(0 0 5px #22d3ee)' }} />
        </svg>
      )

    case 'cyber-dungeon':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Dungeon Stone Chamber */}
          <rect width="64" height="64" rx="8" fill="#181311" />
          <rect x="6" y="6" width="52" height="52" rx="3" stroke="#57534e" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* Golden Key */}
          <g fill="#facc15" style={{ filter: 'drop-shadow(0 0 5px #facc15)' }}>
            <circle cx="46" cy="18" r="5" fill="none" stroke="#facc15" strokeWidth="2" />
            <rect x="45" y="22" width="2" height="8" />
            <rect x="47" y="26" width="3" height="2" />
          </g>
          {/* Warrior with Broadsword */}
          <g transform="translate(4, 2)">
            {/* Steel Helm */}
            <rect x="18" y="20" width="12" height="10" rx="2" fill="#94a3b8" />
            <rect x="20" y="24" width="8" height="3" fill="#facc15" />
            {/* Blue Knight Armor */}
            <rect x="16" y="30" width="16" height="14" rx="3" fill="#2563eb" />
            {/* Glowing Runed Sword Slash */}
            <path d="M30 36 L46 22 M43 21 L47 25 M32 34 L28 38" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }} />
          </g>
          {/* Slime Monster */}
          <ellipse cx="18" cy="48" rx="6" ry="4" fill="#22c55e" style={{ filter: 'drop-shadow(0 0 4px #22c55e)' }} />
        </svg>
      )

    default:
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="8" fill="#27272a" />
          <circle cx="32" cy="32" r="16" stroke="#f59e0b" strokeWidth="3" />
        </svg>
      )
  }
}
