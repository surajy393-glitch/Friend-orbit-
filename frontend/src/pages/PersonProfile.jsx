import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserContext, API } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  ArrowLeft, MessageCircle, Plus, Check, Star, Archive, 
  Edit2, Trash2, Link2, Copy, ExternalLink, Zap
} from 'lucide-react';
import axios from 'axios';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from '../components/ui/alert-dialog';
import { Badge } from '../components/ui/badge';

const PersonProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [person, setPerson] = useState(null);
  const [meteors, setMeteors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMeteor, setShowAddMeteor] = useState(false);
  const [newMeteor, setNewMeteor] = useState({ content: '', tag: '' });
  const [inviteLink, setInviteLink] = useState(null);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [personRes, meteorsRes] = await Promise.all([
          axios.get(`${API}/people/${id}`),
          axios.get(`${API}/meteors?person_id=${id}`)
        ]);
        setPerson(personRes.data);
        setMeteors(meteorsRes.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Failed to load person');
        navigate('/universe');
      } finally {
        setLoading(false);
      }
    };
    
    if (user?.id) fetchData();
  }, [id, user?.id, navigate]);

  const handleLogInteraction = async () => {
    try {
      const res = await axios.post(`${API}/people/${id}/interaction`);
      setPerson(res.data);
      toast.success('Interaction logged! Gravity increased.');
    } catch (error) {
      toast.error('Failed to log interaction');
    }
  };

  const handleTogglePin = async () => {
    try {
      const res = await axios.patch(`${API}/people/${id}`, { pinned: !person.pinned });
      setPerson(res.data);
      toast.success(res.data.pinned ? 'Pinned - no more drifting!' : 'Unpinned');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleArchive = async () => {
    try {
      await axios.delete(`${API}/people/${id}`);
      toast.success('Person archived');
      navigate('/universe');
    } catch (error) {
      toast.error('Failed to archive');
    }
  };

  const handleAddMeteor = async () => {
    if (!newMeteor.content.trim()) {
      toast.error('Please enter a note');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/meteors`, {
        person_id: id,
        content: newMeteor.content,
        tag: newMeteor.tag || null
      });
      setMeteors([res.data, ...meteors]);
      setNewMeteor({ content: '', tag: '' });
      setShowAddMeteor(false);
      toast.success('Meteor added!');
    } catch (error) {
      toast.error('Failed to add meteor');
    }
  };

  const handleToggleMeteorDone = async (meteorId, done) => {
    try {
      const res = await axios.patch(`${API}/meteors/${meteorId}`, { done: !done });
      setMeteors(meteors.map(m => m.id === meteorId ? res.data : m));
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleDeleteMeteor = async (meteorId) => {
    try {
      await axios.delete(`${API}/meteors/${meteorId}`);
      setMeteors(meteors.filter(m => m.id !== meteorId));
      toast.success('Meteor archived');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await axios.post(`${API}/invites?person_id=${id}`);
      setInviteLink(res.data);
      setShowInvite(true);
    } catch (error) {
      toast.error('Failed to generate invite');
    }
  };

  const copyInviteLink = () => {
    if (inviteLink?.link) {
      navigator.clipboard.writeText(inviteLink.link);
      toast.success('Link copied!');
    }
  };

  const getGravityColor = (score) => {
    if (score >= 60) return 'gravity-high';
    if (score >= 30) return 'gravity-medium';
    return 'gravity-low';
  };

  const getArchetypeBadge = (archetype) => {
    const classes = {
      Anchor: 'badge-anchor',
      Spark: 'badge-spark',
      Sage: 'badge-sage',
      Comet: 'badge-comet'
    };
    return classes[archetype] || 'badge-anchor';
  };

  const getTypeBadge = (type) => {
    const classes = {
      partner: 'badge-partner',
      family: 'badge-family',
      friend: 'badge-anchor'
    };
    return classes[type] || 'badge-anchor';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="stars-bg" />
        <div className="relative z-10">
          <div className="w-16 h-16 rounded-full animate-pulse bg-slate-700" />
        </div>
      </div>
    );
  }

  if (!person) return null;

  const planetClass = person.relationship_type === 'partner' 
    ? 'planet-partner' 
    : `planet-${person.archetype?.toLowerCase() || 'anchor'}`;

  return (
    <div className="min-h-screen relative pb-20" data-testid="person-profile">
      {/* Stars background */}
      <div className="stars-bg" />
      
      {/* Header */}
      <div className="relative z-10">
        <div className="p-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/universe')}
            className="h-10 w-10 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 text-white"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTogglePin}
            className={`h-10 w-10 rounded-full bg-slate-900/60 backdrop-blur-md border text-white ${
              person.pinned ? 'border-amber-500/50 text-amber-500' : 'border-white/10'
            }`}
            data-testid="pin-btn"
          >
            <Star className={`w-5 h-5 ${person.pinned ? 'fill-current' : ''}`} />
          </Button>
        </div>
        
        {/* Profile Card */}
        <div className="px-6 py-4">
          <div className="glass-panel rounded-2xl p-6">
            {/* Planet avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-20 h-20 rounded-full ${planetClass} animate-float`} />
              <div className="flex-1">
                <h1 className="font-heading font-bold text-2xl text-white mb-1" data-testid="person-name">
                  {person.name}
                </h1>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={`${getTypeBadge(person.relationship_type)} capitalize`}>
                    {person.relationship_type}
                  </Badge>
                  {person.archetype && (
                    <Badge variant="outline" className={getArchetypeBadge(person.archetype)}>
                      {person.archetype}
                    </Badge>
                  )}
                  {person.pinned && (
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Pinned
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Gravity meter */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">Gravity</span>
                <span className="text-sm font-medium text-white">{Math.round(person.gravity_score)}%</span>
              </div>
              <div className="gravity-meter">
                <div 
                  className={`gravity-meter-fill ${getGravityColor(person.gravity_score)}`}
                  style={{ width: `${person.gravity_score}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-500 capitalize">
                  {person.orbit_zone === 'inner' ? 'Inner Circle' : 
                   person.orbit_zone === 'goldilocks' ? 'Goldilocks Zone' : 'Outer Rim'}
                </span>
                <span className="text-xs text-slate-500">
                  {person.last_interaction 
                    ? `Last: ${new Date(person.last_interaction).toLocaleDateString()}`
                    : 'No interactions yet'
                  }
                </span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              {person.connected ? (
                <Button 
                  className="btn-primary"
                  onClick={() => window.open(`https://t.me/`, '_blank')}
                  data-testid="chat-btn"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat
                </Button>
              ) : (
                <Button 
                  className="btn-secondary"
                  onClick={handleGenerateInvite}
                  data-testid="invite-btn"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Invite
                </Button>
              )}
              <Button 
                className="btn-secondary"
                onClick={handleLogInteraction}
                data-testid="log-interaction-btn"
              >
                <Check className="w-4 h-4 mr-2" />
                Log Interaction
              </Button>
            </div>
          </div>
        </div>
        
        {/* Meteors Section */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-lg text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              Memory Meteors
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddMeteor(true)}
              className="text-violet-400 hover:text-violet-300"
              data-testid="add-meteor-btn"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
          
          {/* Add Meteor Form */}
          {showAddMeteor && (
            <div className="card-meteor mb-4 animate-orbit-entry">
              <Textarea
                data-testid="meteor-content-input"
                value={newMeteor.content}
                onChange={(e) => setNewMeteor({ ...newMeteor, content: e.target.value })}
                placeholder="Remember to ask about..."
                className="input-default mb-3 min-h-[80px]"
              />
              <div className="flex gap-2">
                <Input
                  data-testid="meteor-tag-input"
                  value={newMeteor.tag}
                  onChange={(e) => setNewMeteor({ ...newMeteor, tag: e.target.value })}
                  placeholder="Tag (optional)"
                  className="input-default flex-1"
                />
                <Button onClick={handleAddMeteor} className="btn-primary px-4" data-testid="save-meteor-btn">
                  Save
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowAddMeteor(false)}
                  className="btn-ghost"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          
          {/* Meteors List */}
          {meteors.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No meteors yet. Add notes to remember for your next chat.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meteors.map((meteor, i) => (
                <div 
                  key={meteor.id}
                  className={`card-meteor animate-meteor-float ${meteor.done ? 'opacity-50' : ''}`}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleMeteorDone(meteor.id, meteor.done)}
                      className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        meteor.done 
                          ? 'bg-violet-500 border-violet-500' 
                          : 'border-violet-500/50 hover:border-violet-400'
                      }`}
                      data-testid={`meteor-toggle-${meteor.id}`}
                    >
                      {meteor.done && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <p className={`text-white ${meteor.done ? 'line-through' : ''}`}>
                        {meteor.content}
                      </p>
                      {meteor.tag && (
                        <span className="inline-block mt-1 text-xs text-violet-400 bg-violet-500/20 px-2 py-0.5 rounded-full">
                          {meteor.tag}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteMeteor(meteor.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      data-testid={`meteor-delete-${meteor.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Danger Zone */}
        <div className="px-6 py-4 mt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                data-testid="archive-person-btn"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive {person.name}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-panel border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Archive {person.name}?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  They will be removed from your universe but you can restore them later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="btn-secondary">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive} className="bg-red-500 hover:bg-red-600 text-white">
                  Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      {/* Invite Sheet */}
      <Sheet open={showInvite} onOpenChange={setShowInvite}>
        <SheetContent side="bottom" className="drawer-content">
          <SheetHeader>
            <SheetTitle className="font-heading text-white">Invite {person.name}</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <p className="text-slate-400 text-sm mb-4">
              Share this link with {person.name}. When they accept, you'll be connected!
            </p>
            {inviteLink && (
              <>
                <div className="flex gap-2 mb-4">
                  <Input
                    value={inviteLink.link}
                    readOnly
                    className="input-default flex-1"
                  />
                  <Button onClick={copyInviteLink} className="btn-secondary">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="glass-panel rounded-xl p-4 mb-4">
                  <p className="text-sm text-slate-300">{inviteLink.message_template}</p>
                </div>
                <Button 
                  className="btn-primary w-full"
                  onClick={() => {
                    const text = encodeURIComponent(inviteLink.message_template);
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink.link)}&text=${text}`, '_blank');
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Share on Telegram
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PersonProfile;
