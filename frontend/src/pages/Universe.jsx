import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext, API } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Plus, Search, Settings2, Zap, Filter, X } from 'lucide-react';
import axios from 'axios';
import UniverseMap from '../components/UniverseMap';
import BottomDock from '../components/BottomDock';
import BatteryPrompt from '../components/BatteryWidget';
import AddPlanetModal from '../components/AddPlanetModal';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';

const Universe = () => {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [people, setPeople] = useState([]);
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterArchetype, setFilterArchetype] = useState('all');
  const [showBattery, setShowBattery] = useState(false);
  const [showAddPlanet, setShowAddPlanet] = useState(false);
  const [batteryStatus, setBatteryStatus] = useState(null);

  const fetchPeople = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API}/people`);
      setPeople(res.data);
      setFilteredPeople(res.data);
    } catch (error) {
      console.error('Failed to fetch people:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchBatteryStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API}/battery`);
      setBatteryStatus(res.data);
      // Don't auto-open, just show indicator - user can tap to open
    } catch (error) {
      console.error('Failed to fetch battery:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPeople();
    fetchBatteryStatus();
  }, [fetchPeople, fetchBatteryStatus]);

  // Filter logic
  useEffect(() => {
    let result = [...people];
    
    if (searchQuery) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (filterType !== 'all') {
      result = result.filter(p => p.relationship_type === filterType);
    }
    
    if (filterArchetype !== 'all') {
      result = result.filter(p => p.archetype === filterArchetype);
    }
    
    setFilteredPeople(result);
  }, [people, searchQuery, filterType, filterArchetype]);

  const handlePersonClick = (person) => {
    navigate(`/person/${person.id}`);
  };

  const handleAddPerson = (newPerson) => {
    setPeople([...people, newPerson]);
    setShowAddPlanet(false);
    toast.success(`${newPerson.name} added to your orbit!`);
  };

  const handleBatterySubmit = (result) => {
    setBatteryStatus(result);
    setShowBattery(false);
    toast.success('Battery logged! Here are your suggestions.');
  };

  const hasActiveFilters = filterType !== 'all' || filterArchetype !== 'all' || searchQuery;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="stars-bg" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full sun animate-pulse" />
          <p className="mt-4 text-slate-400">Loading universe...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden relative" data-testid="universe-dashboard">
      {/* Stars background */}
      <div className="stars-bg" />
      
      {/* Top Controls */}
      <div className="fixed top-0 left-0 right-0 z-40 p-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          {/* Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            data-testid="search-toggle-btn"
            onClick={() => setSearchOpen(!searchOpen)}
            className="h-10 w-10 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 text-white hover:bg-slate-800"
          >
            <Search className="w-5 h-5" />
          </Button>
          
          {/* Search Input */}
          {searchOpen && (
            <div className="flex-1 animate-orbit-entry">
              <Input
                data-testid="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people..."
                className="input-default h-10"
                autoFocus
              />
            </div>
          )}
          
          {/* Filter Dropdown */}
          <Sheet>
            <Button
              variant="ghost"
              size="icon"
              data-testid="filter-btn"
              className={`h-10 w-10 rounded-full bg-slate-900/60 backdrop-blur-md border text-white hover:bg-slate-800 ${
                hasActiveFilters ? 'border-violet-500/50' : 'border-white/10'
              }`}
            >
              <Filter className="w-5 h-5" />
            </Button>
          </Sheet>
          
          <div className="flex-1" />
          
          {/* Battery Button */}
          <Button
            variant="ghost"
            size="icon"
            data-testid="battery-btn"
            onClick={() => setShowBattery(true)}
            className={`h-10 w-10 rounded-full bg-slate-900/60 backdrop-blur-md border text-white hover:bg-slate-800 ${
              batteryStatus?.needs_update ? 'border-amber-500/50 animate-pulse' : 'border-white/10'
            }`}
          >
            <Zap className="w-5 h-5" />
          </Button>
          
          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            data-testid="settings-btn"
            onClick={() => navigate('/settings')}
            className="h-10 w-10 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 text-white hover:bg-slate-800"
          >
            <Settings2 className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="max-w-lg mx-auto mt-2 flex gap-2 flex-wrap">
            {filterType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30">
                {filterType}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterType('all')} />
              </span>
            )}
            {filterArchetype !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {filterArchetype}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterArchetype('all')} />
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-slate-500/20 text-slate-300 border border-slate-500/30">
                {searchQuery}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Universe Map */}
      <UniverseMap 
        people={filteredPeople} 
        onPersonClick={handlePersonClick}
        suggestions={batteryStatus?.suggestions || []}
      />
      
      {/* Empty State */}
      {people.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="text-center p-6 glass-panel rounded-2xl max-w-sm pointer-events-auto">
            <div className="w-16 h-16 mx-auto rounded-full sun mb-4" />
            <h2 className="font-heading font-bold text-xl text-white mb-2">Your universe is empty</h2>
            <p className="text-slate-400 text-sm mb-4">Add friends, family, or your partner to start building your orbit.</p>
            <Button 
              onClick={() => setShowAddPlanet(true)} 
              className="btn-primary"
              data-testid="add-first-planet-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Planet
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Dock */}
      <BottomDock 
        onAddClick={() => setShowAddPlanet(true)}
        filterType={filterType}
        setFilterType={setFilterType}
        filterArchetype={filterArchetype}
        setFilterArchetype={setFilterArchetype}
      />

      {/* Battery Prompt Sheet */}
      <Sheet open={showBattery} onOpenChange={setShowBattery}>
        <SheetContent side="bottom" className="drawer-content">
          <SheetHeader>
            <SheetTitle className="font-heading text-white">Social Battery</SheetTitle>
          </SheetHeader>
          <BatteryPrompt 
            userId={user?.id} 
            onSubmit={handleBatterySubmit}
            currentStatus={batteryStatus}
          />
        </SheetContent>
      </Sheet>

      {/* Add Planet Modal */}
      <AddPlanetModal
        open={showAddPlanet}
        onOpenChange={setShowAddPlanet}
        userId={user?.id}
        onAdd={handleAddPerson}
        existingPartner={people.some(p => p.relationship_type === 'partner')}
      />
    </div>
  );
};

export default Universe;
