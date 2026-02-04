import { useMemo } from 'react';

const UniverseMap = ({ people, onPersonClick, suggestions = [] }) => {
  // Deterministic hash function for consistent positioning
  const hashCode = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  // Calculate positions for people based on their gravity scores
  const planetPositions = useMemo(() => {
    const positions = [];
    const innerRadius = 80;   // Inner circle
    const midRadius = 150;    // Goldilocks zone
    const outerRadius = 220;  // Outer rim
    
    // Group people by orbit zone
    const inner = people.filter(p => p.gravity_score >= 60);
    const goldilocks = people.filter(p => p.gravity_score >= 30 && p.gravity_score < 60);
    const outer = people.filter(p => p.gravity_score < 30);
    
    // Position inner circle planets
    inner.forEach((person, i) => {
      const angle = (i / Math.max(inner.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const offset = (hashCode(person.id) % 20) - 10;
      const radius = innerRadius + offset;
      positions.push({
        ...person,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        size: 48,
        zone: 'inner'
      });
    });
    
    // Position goldilocks zone planets
    goldilocks.forEach((person, i) => {
      const angle = (i / Math.max(goldilocks.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const offset = (hashCode(person.id) % 25) - 12;
      const radius = midRadius + offset;
      positions.push({
        ...person,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        size: 40,
        zone: 'goldilocks'
      });
    });
    
    // Position outer rim planets
    outer.forEach((person, i) => {
      const angle = (i / Math.max(outer.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const offset = (hashCode(person.id) % 30) - 15;
      const radius = outerRadius + offset;
      positions.push({
        ...person,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        size: 36,
        zone: 'outer'
      });
    });
    
    return positions;
  }, [people]);

  const getPlanetClass = (person) => {
    if (person.relationship_type === 'partner') return 'planet-partner';
    const archetype = (person.archetype || 'anchor').toLowerCase();
    return `planet-${archetype}`;
  };

  const getGlowClass = (score) => {
    if (score >= 70) return 'glow-high';
    if (score >= 40) return 'glow-medium';
    return 'glow-low';
  };

  const isSuggested = (personId) => {
    return suggestions.some(s => s.id === personId);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Orbit rings */}
      <div 
        className="orbit-ring orbit-ring-inner absolute"
        style={{ width: 160, height: 160 }}
      />
      <div 
        className="orbit-ring orbit-ring-goldilocks absolute"
        style={{ width: 300, height: 300 }}
      />
      <div 
        className="orbit-ring orbit-ring-outer absolute"
        style={{ width: 440, height: 440 }}
      />
      
      {/* Sun (User) */}
      <div 
        className="absolute sun w-16 h-16 rounded-full z-30 cursor-default"
        data-testid="universe-sun"
      >
        <div className="absolute inset-0 rounded-full animate-pulse-glow opacity-50" 
          style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)' }} 
        />
      </div>
      
      {/* Zone labels */}
      <div className="absolute text-[10px] text-amber-500/40 font-medium uppercase tracking-widest"
        style={{ top: 'calc(50% - 95px)' }}>
        Inner Circle
      </div>
      <div className="absolute text-[10px] text-violet-500/30 font-medium uppercase tracking-widest"
        style={{ top: 'calc(50% - 165px)' }}>
        Goldilocks Zone
      </div>
      <div className="absolute text-[10px] text-slate-500/30 font-medium uppercase tracking-widest"
        style={{ top: 'calc(50% - 235px)' }}>
        Outer Rim
      </div>
      
      {/* Planets */}
      {planetPositions.map((planet, index) => (
        <button
          key={planet.id}
          onClick={() => onPersonClick(planet)}
          className={`
            absolute rounded-full cursor-pointer transition-all duration-300
            ${getPlanetClass(planet)}
            ${getGlowClass(planet.gravity_score)}
            ${isSuggested(planet.id) ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent' : ''}
            hover:scale-110 active:scale-95
            animate-orbit-entry
          `}
          style={{
            width: planet.size,
            height: planet.size,
            left: `calc(50% + ${planet.x}px - ${planet.size / 2}px)`,
            top: `calc(50% + ${planet.y}px - ${planet.size / 2}px)`,
            animationDelay: `${index * 0.05}s`,
            zIndex: 20
          }}
          data-testid={`planet-${planet.id}`}
          title={planet.name}
        >
          {/* Planet label */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
            style={{ top: planet.size + 4 }}
          >
            <span className={`text-xs font-medium ${
              planet.zone === 'inner' ? 'text-white' :
              planet.zone === 'goldilocks' ? 'text-slate-300' : 'text-slate-500'
            }`}>
              {planet.name}
            </span>
          </div>
          
          {/* Suggested indicator */}
          {isSuggested(planet.id) && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center animate-pulse">
              <span className="text-[8px] text-slate-900 font-bold">!</span>
            </div>
          )}
          
          {/* Partner badge */}
          {planet.relationship_type === 'partner' && (
            <div className="absolute -bottom-1 -right-1 text-xs">💞</div>
          )}
        </button>
      ))}
    </div>
  );
};

export default UniverseMap;
