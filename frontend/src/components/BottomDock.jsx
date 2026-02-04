import { Button } from './ui/button';
import { Plus, Users, Heart, Home, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from './ui/dropdown-menu';

const BottomDock = ({ 
  onAddClick, 
  filterType, 
  setFilterType,
  filterArchetype,
  setFilterArchetype 
}) => {
  const typeFilters = [
    { value: 'all', label: 'All', icon: Users },
    { value: 'partner', label: 'Partner', icon: Heart },
    { value: 'family', label: 'Family', icon: Home },
    { value: 'friend', label: 'Friends', icon: Users }
  ];

  const archetypeFilters = [
    { value: 'all', label: 'All Archetypes' },
    { value: 'Anchor', label: 'Anchor', color: 'text-emerald-400' },
    { value: 'Spark', label: 'Spark', color: 'text-pink-400' },
    { value: 'Sage', label: 'Sage', color: 'text-violet-400' },
    { value: 'Comet', label: 'Comet', color: 'text-cyan-400' }
  ];

  return (
    <div className="bottom-dock" data-testid="bottom-dock">
      {/* Type Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-12 w-12 rounded-full ${
              filterType !== 'all' 
                ? 'bg-violet-500/20 text-violet-400' 
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            data-testid="type-filter-dropdown"
          >
            <Users className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="glass-panel border-white/10 mb-2" align="center">
          <DropdownMenuLabel className="text-slate-400 text-xs">Filter by Type</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          {typeFilters.map(filter => (
            <DropdownMenuItem 
              key={filter.value}
              onClick={() => setFilterType(filter.value)}
              className={`cursor-pointer ${filterType === filter.value ? 'text-violet-400 bg-violet-500/10' : 'text-slate-300'}`}
            >
              <filter.icon className="w-4 h-4 mr-2" />
              {filter.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Archetype Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-12 w-12 rounded-full ${
              filterArchetype !== 'all' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            data-testid="archetype-filter-dropdown"
          >
            <Sparkles className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="glass-panel border-white/10 mb-2" align="center">
          <DropdownMenuLabel className="text-slate-400 text-xs">Filter by Archetype</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          {archetypeFilters.map(filter => (
            <DropdownMenuItem 
              key={filter.value}
              onClick={() => setFilterArchetype(filter.value)}
              className={`cursor-pointer ${filterArchetype === filter.value ? `${filter.color || 'text-white'} bg-white/5` : 'text-slate-300'}`}
            >
              <span className={`w-2 h-2 rounded-full mr-2 ${
                filter.value === 'Anchor' ? 'bg-emerald-400' :
                filter.value === 'Spark' ? 'bg-pink-400' :
                filter.value === 'Sage' ? 'bg-violet-400' :
                filter.value === 'Comet' ? 'bg-cyan-400' : 'bg-slate-400'
              }`} />
              {filter.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Button */}
      <Button
        onClick={onAddClick}
        className="h-14 w-14 rounded-full bg-white text-slate-950 hover:bg-slate-200 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
        data-testid="add-planet-dock-btn"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
};

export default BottomDock;
