import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext, API } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Orbit, Users, Zap, Check } from 'lucide-react';
import axios from 'axios';
import AddPlanetForm from '../components/AddPlanetForm';

const Setup = () => {
  const { user, updateUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    display_name: user?.display_name || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    inner_circle_size: 6,
    drift_strictness: 'normal'
  });
  const [addedPeople, setAddedPeople] = useState([]);
  const [showAddPlanet, setShowAddPlanet] = useState(false);
  const [addType, setAddType] = useState('friend');

  const steps = [
    { title: 'Profile', icon: Orbit },
    { title: 'Preferences', icon: Zap },
    { title: 'First Planets', icon: Users }
  ];

  const handleNext = async () => {
    if (step === 0) {
      // Validate profile
      if (!formData.display_name.trim()) {
        toast.error('Please enter your name');
        return;
      }
      // Update user
      try {
        await axios.patch(`${API}/users/${user.id}`, {
          display_name: formData.display_name,
          timezone: formData.timezone
        });
        updateUser({ display_name: formData.display_name, timezone: formData.timezone });
      } catch (error) {
        console.error('Update error:', error);
      }
    }
    
    if (step === 1) {
      // Update preferences
      try {
        await axios.patch(`${API}/users/${user.id}`, {
          inner_circle_size: formData.inner_circle_size,
          drift_strictness: formData.drift_strictness
        });
        updateUser({ 
          inner_circle_size: formData.inner_circle_size, 
          drift_strictness: formData.drift_strictness 
        });
      } catch (error) {
        console.error('Update error:', error);
      }
    }
    
    if (step < 2) {
      setStep(step + 1);
    } else {
      // Complete onboarding
      try {
        await axios.post(`${API}/users/${user.id}/onboard`);
        updateUser({ onboarded: true });
        toast.success('Welcome to your universe!');
        navigate('/universe');
      } catch (error) {
        toast.error('Failed to complete setup');
      }
    }
  };

  const handleAddPerson = (person) => {
    setAddedPeople([...addedPeople, person]);
    setShowAddPlanet(false);
    toast.success(`${person.name} added to your orbit!`);
  };

  return (
    <div className="h-screen relative flex flex-col">
      {/* Stars background */}
      <div className="stars-bg" />
      
      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Progress - Fixed header */}
        <div className="flex-shrink-0 p-6 pt-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${i <= step 
                    ? 'bg-white text-slate-950' 
                    : 'bg-slate-800/50 text-slate-500 border border-white/10'
                  }
                `}>
                  {i < step ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${i < step ? 'bg-white' : 'bg-slate-700'}`} />
                )}
              </div>
            ))}
          </div>
          
          <h1 className="text-2xl font-heading font-bold text-center mb-2">
            {steps[step].title}
          </h1>
        </div>

        {/* Step Content - Scrollable area */}
        <div className="flex-1 overflow-y-auto px-6 pb-28" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Step 0: Profile */}
          {step === 0 && (
            <div className="max-w-md mx-auto space-y-6 animate-orbit-entry" data-testid="setup-profile-step">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto rounded-full sun mb-4" />
                <p className="text-slate-400">You are the Sun. Everything orbits around you.</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-slate-300 mb-2 block">Your Name</Label>
                  <Input
                    id="name"
                    data-testid="setup-name-input"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Enter your name"
                    className="input-default"
                  />
                </div>
                
                <div>
                  <Label className="text-slate-300 mb-2 block">Timezone</Label>
                  <div className="input-default bg-slate-800/30 text-slate-400">
                    {formData.timezone}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Auto-detected from your device</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Preferences */}
          {step === 1 && (
            <div className="max-w-md mx-auto space-y-8 animate-orbit-entry" data-testid="setup-preferences-step">
              <div>
                <Label className="text-slate-300 mb-3 block">Inner Circle Size</Label>
                <p className="text-sm text-slate-500 mb-4">How many people should be in your closest orbit?</p>
                <RadioGroup
                  value={String(formData.inner_circle_size)}
                  onValueChange={(v) => setFormData({ ...formData, inner_circle_size: Number(v) })}
                  className="grid grid-cols-3 gap-3"
                >
                  {[6, 10, 15].map(size => (
                    <div key={size}>
                      <RadioGroupItem value={String(size)} id={`size-${size}`} className="peer sr-only" />
                      <Label
                        htmlFor={`size-${size}`}
                        className="flex flex-col items-center p-4 rounded-xl border border-white/10 bg-slate-900/40 cursor-pointer transition-all peer-data-[state=checked]:border-amber-500/50 peer-data-[state=checked]:bg-amber-500/10"
                      >
                        <span className="text-2xl font-heading font-bold text-white">{size}</span>
                        <span className="text-xs text-slate-500">people</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              
              <div>
                <Label className="text-slate-300 mb-3 block">Drift Strictness</Label>
                <p className="text-sm text-slate-500 mb-4">How fast should people drift when you don't interact?</p>
                <RadioGroup
                  value={formData.drift_strictness}
                  onValueChange={(v) => setFormData({ ...formData, drift_strictness: v })}
                  className="space-y-3"
                >
                  {[
                    { value: 'gentle', label: 'Gentle', desc: 'Slow drift, more forgiving' },
                    { value: 'normal', label: 'Normal', desc: 'Balanced drift rate' },
                    { value: 'strict', label: 'Strict', desc: 'Fast drift - stay on top of it' }
                  ].map(opt => (
                    <div key={opt.value}>
                      <RadioGroupItem value={opt.value} id={`drift-${opt.value}`} className="peer sr-only" />
                      <Label
                        htmlFor={`drift-${opt.value}`}
                        className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-slate-900/40 cursor-pointer transition-all peer-data-[state=checked]:border-violet-500/50 peer-data-[state=checked]:bg-violet-500/10"
                      >
                        <div>
                          <span className="font-medium text-white">{opt.label}</span>
                          <p className="text-sm text-slate-500">{opt.desc}</p>
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 border-white/20 peer-data-[state=checked]:bg-violet-500 peer-data-[state=checked]:border-violet-500 transition-all" />
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 2: Add First People */}
          {step === 2 && (
            <div className="max-w-md mx-auto animate-orbit-entry" data-testid="setup-planets-step">
              <p className="text-center text-slate-400 mb-6">
                Add your first planets to get started. You can always add more later.
              </p>
              
              {/* Added people */}
              {addedPeople.length > 0 && (
                <div className="mb-6 space-y-2">
                  {addedPeople.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-white/5">
                      <div className={`w-10 h-10 rounded-full planet-${p.archetype?.toLowerCase() || 'anchor'}`} />
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{p.relationship_type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add buttons */}
              {!showAddPlanet && (
                <div className="grid gap-3">
                  <Button
                    variant="outline"
                    data-testid="add-partner-btn"
                    onClick={() => { setAddType('partner'); setShowAddPlanet(true); }}
                    className="h-auto py-4 justify-start gap-4 bg-slate-900/40 border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30"
                    disabled={addedPeople.some(p => p.relationship_type === 'partner')}
                  >
                    <div className="w-10 h-10 rounded-full planet-partner" />
                    <div className="text-left">
                      <p className="font-medium text-white">Add Partner</p>
                      <p className="text-xs text-slate-500">bf/gf/wife/husband</p>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    data-testid="add-family-btn"
                    onClick={() => { setAddType('family'); setShowAddPlanet(true); }}
                    className="h-auto py-4 justify-start gap-4 bg-slate-900/40 border-white/10 hover:bg-amber-500/10 hover:border-amber-500/30"
                  >
                    <div className="w-10 h-10 rounded-full planet-sage" />
                    <div className="text-left">
                      <p className="font-medium text-white">Add Family</p>
                      <p className="text-xs text-slate-500">mom, dad, sibling...</p>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    data-testid="add-friend-btn"
                    onClick={() => { setAddType('friend'); setShowAddPlanet(true); }}
                    className="h-auto py-4 justify-start gap-4 bg-slate-900/40 border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                  >
                    <div className="w-10 h-10 rounded-full planet-anchor" />
                    <div className="text-left">
                      <p className="font-medium text-white">Add Friend</p>
                      <p className="text-xs text-slate-500">close friends</p>
                    </div>
                  </Button>
                </div>
              )}
              
              {/* Add form */}
              {showAddPlanet && (
                <AddPlanetForm
                  type={addType}
                  userId={user.id}
                  onAdd={handleAddPerson}
                  onCancel={() => setShowAddPlanet(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        <div className="fixed bottom-0 left-0 right-0 p-6 glass-modal">
          <div className="max-w-md mx-auto flex gap-3">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="btn-secondary flex-1"
                data-testid="setup-back-btn"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="btn-primary flex-1"
              data-testid="setup-next-btn"
            >
              {step === 2 ? (addedPeople.length === 0 ? 'Skip for now' : 'Enter Universe') : 'Continue'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Setup;
