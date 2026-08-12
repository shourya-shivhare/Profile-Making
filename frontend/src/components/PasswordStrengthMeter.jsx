import { Check, X } from 'lucide-react';

// Password requirements must match backend strongPassword schema:
// min 12 chars, uppercase, number, special character
export default function PasswordStrengthMeter({ password }) {
  const getStrength = (pass) => {
    let score = 0;
    if (!pass) return { score: 0, label: 'Too short', color: 'bg-slate-700' };

    if (pass.length >= 12) score += 2;     // 12+ chars is worth extra
    else if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score < 2) return { score, label: 'Weak',   color: 'bg-red-500' };
    if (score < 4) return { score, label: 'Fair',   color: 'bg-amber-400' };
    if (score < 5) return { score, label: 'Good',   color: 'bg-blue-400' };
    return           { score, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getStrength(password);

  const rules = [
    { label: 'At least 12 characters', met: (password || '').length >= 12 },
    { label: 'One uppercase letter',   met: /[A-Z]/.test(password || '') },
    { label: 'One number',             met: /[0-9]/.test(password || '') },
    { label: 'One special character',  met: /[^A-Za-z0-9]/.test(password || '') },
  ];

  return (
    <div className="mt-2 space-y-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/80 shadow-inner">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-slate-400">Password Strength:</span>
        <span className={strength.color.replace('bg-', 'text-')}>{strength.label}</span>
      </div>

      <div className="flex gap-1 h-1.5">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`flex-1 rounded-full transition-all duration-500 ${
              index < Math.min(Math.ceil(strength.score / 1.25), 4) ? strength.color : 'bg-slate-700/30'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${rule.met ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
              {rule.met ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
            </div>
            <span className={`text-[11px] font-medium ${rule.met ? 'text-slate-300' : 'text-slate-500'}`}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
