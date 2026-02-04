import { useState } from 'react';
import { API } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { toast } from 'sonner';
import axios from 'axios';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Heart, Home, Users } from 'lucide-react';

const AddPlanetModal = ({ open, onOpenChange, userId, onAdd, existingPartner }) => {
  const [activeTab, setActiveTab] = useState('friend');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    relationship_subtype: '',
    archetype: 'Anchor',
    tags: ''
  });

  const archetypes = [
    { value: 'Anchor', label: 'Anchor', desc: 'Stable, always there', color: 'emerald' },
    { value: 'Spark', label: 'Spark', desc: 'Energizing, fun', color: 'pink' },
    { value: 'Sage', label: 'Sage', desc: 'Wise, advisor', color: 'violet' },
    { value: 'Comet', label: 'Comet', desc: 'Comes and goes', color: 'cyan' }
  ];

  const familySubtypes = ['Mom', 'Dad', 'Brother', 'Sister', 'Grandparent', 'Cousin', 'Other'];

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        relationship_type: activeTab,
        relationship_subtype: activeTab === 'family' ? formData.relationship_subtype : null,
        archetype: activeTab === 'partner' ? null : formData.archetype,
        cadence_days: activeTab === 'partner' ? 1 : activeTab === 'family' ? 7 : 14,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      };

      const res = await axios.post(`${API}/people`, payload);
      onAdd(res.data);
      
      // Reset form
      setFormData({ name: '', relationship_subtype: '', archetype: 'Anchor', tags: '' });
      onOpenChange(false);
    } catch (error) {
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to add person');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="drawer-content h-[85vh]">
        <SheetHeader>
          <SheetTitle className="font-heading text-white">Add to Your Orbit</SheetTitle>
        </SheetHeader>
        
        <div className="py-4 overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Type tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid grid-cols-3 gap-1 bg-slate-900/60 border border-white/10 p-1 rounded-xl">
              <TabsTrigger 
                value="partner" 
                disabled={existingPartner}
                className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-400 rounded-lg"
                data-testid="tab-partner"
              >
                <Heart className="w-4 h-4 mr-1" />
                Partner
              </TabsTrigger>
              <TabsTrigger 
                value="family" 
                className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 rounded-lg"
                data-testid="tab-family"
              >
                <Home className="w-4 h-4 mr-1" />
                Family
              </TabsTrigger>
              <TabsTrigger 
                value="friend" 
                className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 rounded-lg"
                data-testid="tab-friend"
              >
                <Users className="w-4 h-4 mr-1" />
                Friend
              </TabsTrigger>
            </TabsList>

            {/* Partner Tab */}
            <TabsContent value="partner" className="mt-4 space-y-4">
              {existingPartner ? (
                <div className="text-center py-8 text-slate-400">
                  <Heart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>You already have a partner in your orbit</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 mx-auto rounded-full planet-partner mb-2" />
                    <p className="text-sm text-slate-400">Your partner will always stay close</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 mb-2 block">Name</Label>
                    <Input
                      data-testid="partner-name-input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Partner's name"
                      className="input-default"
                    />
                  </div>
                </>
              )}
            </TabsContent>

            {/* Family Tab */}
            <TabsContent value="family" className="mt-4 space-y-4">
              <div>
                <Label className="text-slate-400 mb-2 block">Name</Label>
                <Input
                  data-testid="family-name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Family member's name"
                  className="input-default"
                />
              </div>
              
              <div>
                <Label className="text-slate-400 mb-2 block">Relationship</Label>
                <div className="grid grid-cols-4 gap-2">
                  {familySubtypes.map(sub => (
                    <Button
                      key={sub}
                      variant="outline"
                      onClick={() => setFormData({ ...formData, relationship_subtype: sub })}
                      className={`text-xs py-2 ${
                        formData.relationship_subtype === sub
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-slate-900/40 border-white/10 text-slate-300'
                      }`}
                    >
                      {sub}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-slate-400 mb-2 block">Archetype (optional)</Label>
                <RadioGroup
                  value={formData.archetype}
                  onValueChange={(v) => setFormData({ ...formData, archetype: v })}
                  className="grid grid-cols-2 gap-2"
                >
                  {archetypes.map(arch => (
                    <div key={arch.value}>
                      <RadioGroupItem value={arch.value} id={`family-arch-${arch.value}`} className="peer sr-only" />
                      <Label
                        htmlFor={`family-arch-${arch.value}`}
                        className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all peer-data-[state=checked]:border-${arch.color}-500/50 peer-data-[state=checked]:bg-${arch.color}-500/10 border-white/10 bg-slate-900/40`}
                      >
                        <div className={`w-4 h-4 rounded-full planet-${arch.value.toLowerCase()}`} />
                        <div>
                          <span className="text-sm text-white">{arch.label}</span>
                          <p className="text-xs text-slate-500">{arch.desc}</p>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </TabsContent>

            {/* Friend Tab */}
            <TabsContent value="friend" className="mt-4 space-y-4">
              <div>
                <Label className="text-slate-400 mb-2 block">Name</Label>
                <Input
                  data-testid="friend-name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Friend's name"
                  className="input-default"
                />
              </div>
              
              <div>
                <Label className="text-slate-400 mb-2 block">Archetype</Label>
                <p className="text-xs text-slate-500 mb-3">What kind of friend are they?</p>
                <RadioGroup
                  value={formData.archetype}
                  onValueChange={(v) => setFormData({ ...formData, archetype: v })}
                  className="grid grid-cols-2 gap-2"
                >
                  {archetypes.map(arch => (
                    <div key={arch.value}>
                      <RadioGroupItem value={arch.value} id={`friend-arch-${arch.value}`} className="peer sr-only" />
                      <Label
                        htmlFor={`friend-arch-${arch.value}`}
                        className="flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all peer-data-[state=checked]:border-white/30 peer-data-[state=checked]:bg-white/5 border-white/10 bg-slate-900/40"
                      >
                        <div className={`w-6 h-6 rounded-full planet-${arch.value.toLowerCase()}`} />
                        <div>
                          <span className="text-sm text-white">{arch.label}</span>
                          <p className="text-xs text-slate-500">{arch.desc}</p>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              
              <div>
                <Label className="text-slate-400 mb-2 block">Tags (optional)</Label>
                <Input
                  data-testid="friend-tags-input"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="gym, college, work (comma separated)"
                  className="input-default"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={loading || (activeTab === 'partner' && existingPartner)}
            className="btn-primary w-full mt-4"
            data-testid="add-planet-submit-btn"
          >
            {loading ? 'Adding...' : `Add ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddPlanetModal;
