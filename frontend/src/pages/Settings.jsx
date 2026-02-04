import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext, API } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Slider } from '../components/ui/slider';
import { toast } from 'sonner';
import { ArrowLeft, User, Orbit, Bell, Shield, Download, Trash2 } from 'lucide-react';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from '../components/ui/alert-dialog';

const Settings = () => {
  const { user, updateUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    display_name: user?.display_name || '',
    inner_circle_size: user?.inner_circle_size || 6,
    drift_strictness: user?.drift_strictness || 'normal',
    daily_reminder: true,
    drift_alerts: true,
    digest_time: '10:00'
  });

  const handleSave = async (field, value) => {
    setSaving(true);
    try {
      await axios.patch(`${API}/users/${user.id}`, { [field]: value });
      updateUser({ [field]: value });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen relative" data-testid="settings-page">
      {/* Stars background */}
      <div className="stars-bg" />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="p-4 flex items-center gap-3 border-b border-white/5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/universe')}
            className="h-10 w-10 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 text-white"
            data-testid="settings-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-heading font-bold text-xl text-white">Settings</h1>
        </div>
        
        {/* Tabs */}
        <Tabs defaultValue="account" className="p-4">
          <TabsList className="grid grid-cols-4 gap-1 bg-slate-900/60 backdrop-blur-md border border-white/10 p-1 rounded-xl">
            <TabsTrigger value="account" className="data-[state=active]:bg-white data-[state=active]:text-slate-950 rounded-lg text-xs">
              <User className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="orbit" className="data-[state=active]:bg-white data-[state=active]:text-slate-950 rounded-lg text-xs">
              <Orbit className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-white data-[state=active]:text-slate-950 rounded-lg text-xs">
              <Bell className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="privacy" className="data-[state=active]:bg-white data-[state=active]:text-slate-950 rounded-lg text-xs">
              <Shield className="w-4 h-4" />
            </TabsTrigger>
          </TabsList>
          
          {/* Account Tab */}
          <TabsContent value="account" className="mt-6 space-y-6">
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg text-white mb-4">Profile</h2>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-400 mb-2 block">Display Name</Label>
                  <div className="flex gap-2">
                    <Input
                      data-testid="display-name-input"
                      value={settings.display_name}
                      onChange={(e) => setSettings({ ...settings, display_name: e.target.value })}
                      className="input-default flex-1"
                    />
                    <Button 
                      onClick={() => handleSave('display_name', settings.display_name)}
                      disabled={saving}
                      className="btn-secondary"
                    >
                      Save
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label className="text-slate-400 mb-2 block">Timezone</Label>
                  <div className="input-default bg-slate-800/30 text-slate-400">
                    {user?.timezone || 'Asia/Kolkata'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg text-white mb-4">Data</h2>
              
              <div className="space-y-3">
                <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-white/5">
                  <Download className="w-4 h-4 mr-3" />
                  Export Data (Coming Soon)
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4 mr-3" />
                      Delete All Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-panel border-white/10">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Delete all data?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        This will permanently delete your universe, all people, and meteors. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="btn-secondary">Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white">
                        Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </TabsContent>
          
          {/* Orbit Rules Tab */}
          <TabsContent value="orbit" className="mt-6 space-y-6">
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg text-white mb-4">Orbit Rules</h2>
              
              <div className="space-y-6">
                <div>
                  <Label className="text-slate-400 mb-3 block">Inner Circle Size</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[settings.inner_circle_size]}
                      onValueChange={([v]) => setSettings({ ...settings, inner_circle_size: v })}
                      onValueCommit={([v]) => handleSave('inner_circle_size', v)}
                      min={3}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-white font-bold w-8 text-center">{settings.inner_circle_size}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">How many people can be in your closest orbit</p>
                </div>
                
                <div>
                  <Label className="text-slate-400 mb-3 block">Drift Strictness</Label>
                  <RadioGroup
                    value={settings.drift_strictness}
                    onValueChange={(v) => {
                      setSettings({ ...settings, drift_strictness: v });
                      handleSave('drift_strictness', v);
                    }}
                    className="space-y-2"
                  >
                    {[
                      { value: 'gentle', label: 'Gentle', desc: 'Slow drift - more forgiving' },
                      { value: 'normal', label: 'Normal', desc: 'Balanced drift rate' },
                      { value: 'strict', label: 'Strict', desc: 'Fast drift - stay on top of it' }
                    ].map(opt => (
                      <div key={opt.value}>
                        <RadioGroupItem value={opt.value} id={`drift-${opt.value}`} className="peer sr-only" />
                        <Label
                          htmlFor={`drift-${opt.value}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-slate-900/40 cursor-pointer transition-all peer-data-[state=checked]:border-violet-500/50 peer-data-[state=checked]:bg-violet-500/10"
                        >
                          <div>
                            <span className="font-medium text-white text-sm">{opt.label}</span>
                            <p className="text-xs text-slate-500">{opt.desc}</p>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </div>
            
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg text-white mb-4">Cadence Presets</h2>
              <p className="text-sm text-slate-400 mb-4">Default check-in frequencies by relationship type</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/10">
                  <div>
                    <span className="text-white font-medium">Partner</span>
                    <p className="text-xs text-slate-500">Daily / Alternate day</p>
                  </div>
                  <span className="text-amber-400 text-sm">1-2 days</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/10">
                  <div>
                    <span className="text-white font-medium">Family</span>
                    <p className="text-xs text-slate-500">Weekly check-in</p>
                  </div>
                  <span className="text-violet-400 text-sm">3-7 days</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/10">
                  <div>
                    <span className="text-white font-medium">Friends</span>
                    <p className="text-xs text-slate-500">Bi-weekly</p>
                  </div>
                  <span className="text-emerald-400 text-sm">7-14 days</span>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-6 space-y-6">
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg text-white mb-4">Notifications</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/10">
                  <div>
                    <span className="text-white font-medium">Daily Battery Reminder</span>
                    <p className="text-xs text-slate-500">Get reminded to log your social battery</p>
                  </div>
                  <Switch
                    checked={settings.daily_reminder}
                    onCheckedChange={(v) => setSettings({ ...settings, daily_reminder: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/10">
                  <div>
                    <span className="text-white font-medium">Drift Alerts</span>
                    <p className="text-xs text-slate-500">When someone moves to Outer Rim</p>
                  </div>
                  <Switch
                    checked={settings.drift_alerts}
                    onCheckedChange={(v) => setSettings({ ...settings, drift_alerts: v })}
                  />
                </div>
              </div>
            </div>
            
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg text-white mb-4">Timing</h2>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-400 mb-2 block">Battery Prompt</Label>
                  <div className="input-default bg-slate-800/30 text-slate-300">
                    10:00 AM IST (Daily)
                  </div>
                </div>
                <div>
                  <Label className="text-slate-400 mb-2 block">Drift Digest</Label>
                  <div className="input-default bg-slate-800/30 text-slate-300">
                    Sunday 7:00 PM IST (Weekly)
                  </div>
                </div>
                <p className="text-xs text-slate-500">Custom timing coming soon</p>
              </div>
            </div>
          </TabsContent>
          
          {/* Privacy Tab */}
          <TabsContent value="privacy" className="mt-6 space-y-6">
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg text-white mb-4">What We Store</h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                  <div>
                    <p className="text-white">Your Telegram ID (for authentication)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                  <div>
                    <p className="text-white">Names you enter for people</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                  <div>
                    <p className="text-white">Your notes (meteors)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                  <div>
                    <p className="text-white">Interaction timestamps</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg text-white mb-4">What We Do Not Store</h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                  <div>
                    <p className="text-white">Your Telegram messages</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                  <div>
                    <p className="text-white">Contact information of others</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                  <div>
                    <p className="text-white">Any data from connected friends</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg text-white mb-4">Connected Friends</h2>
              <p className="text-sm text-slate-400">
                When someone accepts your invite, they only see that they are connected to you. 
                They cannot see your other connections, gravity scores, or any of your data.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
