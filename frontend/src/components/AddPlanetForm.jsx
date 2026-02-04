import { useState } from 'react';
import { API } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { toast } from 'sonner';
import axios from 'axios';
import { X } from 'lucide-react';

const AddPlanetForm = ({ type, userId, onAdd, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    relationship_subtype: '',
    archetype: 'Anchor'
  });

  const archetypes = [
    { value: 'Anchor', label: 'Anchor', desc: 'Stable, always there', color: 'emerald' },
    { value: 'Spark', label: 'Spark', desc: 'Energizing, fun', color: 'pink' },
    { value: 'Sage', label: 'Sage', desc: 'Wise, advisor', color: 'violet' },
    { value: 'Comet', label: 'Comet', desc: 'Comes and goes', color: 'cyan' }
  ];

  const familySubtypes = ['Mom', 'Dad', 'Brother', 'Sister', 'Other'];

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        relationship_type: type,
        relationship_subtype: type === 'family' ? formData.relationship_subtype : null,
        archetype: formData.archetype || 'Anchor',
        cadence_days: type === 'partner' ? 1 : type === 'family' ? 7 : 14
      };

      const res = await axios.post(`${API}/people`, payload);
      onAdd(res.data);
    } catch (error) {
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to add');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-planet animate-orbit-entry" data-testid="add-planet-form">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-white capitalize">Add {type}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <Label className="text-slate-400 mb-2 block">Name</Label>
          <Input
            data-testid="add-planet-name-input"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onFocus={(e) => {
              // Scroll input into view when keyboard opens on mobile
              setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            }}
            placeholder={`${type}'s name`}
            className="input-default"
            autoFocus
          />
        </div>

        {/* Family subtype */}
        {type === 'family' && (
          <div>
            <Label className="text-slate-400 mb-2 block">Relationship</Label>
            <div className="flex flex-wrap gap-2">
              {familySubtypes.map(sub => (
                <Button
                  key={sub}
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, relationship_subtype: sub })}
                  className={`text-xs ${
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
        )}

        {/* Archetype for friends and family */}
        {type !== 'partner' && (
          <div>
            <Label className="text-slate-400 mb-2 block">Archetype</Label>
            <RadioGroup
              value={formData.archetype}
              onValueChange={(v) => setFormData({ ...formData, archetype: v })}
              className="grid grid-cols-2 gap-2"
            >
              {archetypes.map(arch => (
                <div key={arch.value}>
                  <RadioGroupItem value={arch.value} id={`setup-arch-${arch.value}`} className="peer sr-only" />
                  <Label
                    htmlFor={`setup-arch-${arch.value}`}
                    className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all peer-data-[state=checked]:border-white/30 peer-data-[state=checked]:bg-white/5 border-white/10 bg-slate-900/40"
                  >
                    <div className={`w-5 h-5 rounded-full planet-${arch.value.toLowerCase()}`} />
                    <span className="text-xs text-white">{arch.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="btn-secondary flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex-1"
            data-testid="add-planet-form-submit"
          >
            {loading ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddPlanetForm;
