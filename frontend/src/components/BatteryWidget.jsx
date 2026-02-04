import { useState } from 'react';
import { API } from '../App';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import axios from 'axios';
import { Zap } from 'lucide-react';

function BatteryPrompt({ userId, onSubmit, currentStatus }) {
  const [score, setScore] = useState(currentStatus?.score || 50);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/battery?score=${score}`);
      onSubmit(res.data);
    } catch (error) {
      console.error('Failed to log battery:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBatteryColor = () => {
    if (score <= 20) return 'text-red-400';
    if (score <= 40) return 'text-orange-400';
    if (score <= 60) return 'text-amber-400';
    if (score <= 80) return 'text-emerald-400';
    return 'text-green-400';
  };

  const quickOptions = [10, 30, 50, 80, 100];

  return (
    <div className="py-4" data-testid="battery-prompt">
      <div className="text-center mb-6">
        <div className={`w-16 h-16 mx-auto mb-2 rounded-full flex items-center justify-center ${getBatteryColor()} bg-current/20`}>
          <Zap className="w-8 h-8" />
        </div>
        <p className="text-slate-400">How is your social battery today?</p>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-6">
        {quickOptions.map((opt) => (
          <Button
            key={opt}
            variant="outline"
            onClick={() => setScore(opt)}
            className={`h-12 rounded-xl border transition-all ${
              score === opt 
                ? 'bg-white/10 border-white/30 text-white' 
                : 'bg-slate-900/40 border-white/10 text-slate-400 hover:bg-slate-800/40'
            }`}
            data-testid={`battery-option-${opt}`}
          >
            {opt}%
          </Button>
        ))}
      </div>

      <div className="mb-6">
        <Slider
          value={[score]}
          onValueChange={(v) => setScore(v[0])}
          min={0}
          max={100}
          step={5}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>Drained</span>
          <span className={`font-bold text-lg ${getBatteryColor()}`}>{score}%</span>
          <span>Fully charged</span>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-4 mb-6">
        <p className="text-sm text-slate-300">
          {score <= 20 && <><span className="text-red-400 font-medium">Low energy day.</span> We will suggest just one person.</>}
          {score > 20 && score <= 50 && <><span className="text-amber-400 font-medium">Moderate energy.</span> A couple of quick check-ins.</>}
          {score > 50 && score <= 80 && <><span className="text-emerald-400 font-medium">Good energy!</span> Great day to reconnect.</>}
          {score > 80 && <><span className="text-green-400 font-medium">Fully charged!</span> Reach out to your Outer Rim.</>}
        </p>
      </div>

      <Button 
        onClick={handleSubmit} 
        disabled={loading}
        className="btn-primary w-full"
        data-testid="battery-submit-btn"
      >
        <Zap className="w-4 h-4 mr-2" />
        {loading ? 'Logging...' : 'Log Battery'}
      </Button>

      {currentStatus?.suggestions?.length > 0 && (
        <div className="mt-6">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Suggestions</p>
          <div className="space-y-2">
            {currentStatus.suggestions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40">
                <div className="w-8 h-8 rounded-full bg-emerald-500" />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BatteryPrompt;
