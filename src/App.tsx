import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Square, 
  Settings, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Clipboard, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  ChevronDown, 
  ExternalLink, 
  RefreshCw, 
  FileText, 
  Clock, 
  User,
  ChevronRight,
  Info,
  X,
  Lock
} from 'lucide-react';
import { DEFAULT_FORMS } from './data';
import { FormConfig, ShiftStatus, ShiftState } from './types';

export default function App() {
  // --- STATE ---
  const [forms, setForms] = useState<FormConfig[]>(() => {
    const saved = localStorage.getItem('gghl_forms');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as FormConfig[];
        // Filter out default forms from local storage to ensure code-defined DEFAULT_FORMS are permanent
        const customForms = parsed.filter(f => !f.isDefault);
        return [...DEFAULT_FORMS, ...customForms];
      } catch (e) {
        return DEFAULT_FORMS;
      }
    }
    return DEFAULT_FORMS;
  });

  const [shift, setShift] = useState<ShiftState>(() => {
    const saved = localStorage.getItem('gghl_shift_state');
    return saved ? JSON.parse(saved) : {
      status: 'idle',
      startTime: null,
      endTime: null,
      selectedSecondaryIds: [],
      activeFormId: null,
    };
  });

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(() => {
    return localStorage.getItem('dhl_admin_authorized') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormUrl, setNewFormUrl] = useState('');
  const [newFormCategory, setNewFormCategory] = useState<'main' | 'secondary' | 'finish'>('secondary');
  
  // Quick status / feedback alerts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Secret tap handler to open the Admin Panel without exposing a button to drivers
  const [logoClicks, setLogoClicks] = useState(0);

  useEffect(() => {
    if (logoClicks > 0) {
      const timer = setTimeout(() => setLogoClicks(0), 4000);
      return () => clearTimeout(timer);
    }
  }, [logoClicks]);

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setIsAdminOpen(true);
        triggerToast('Coordinator Access: Please input passcode.', 'info');
        return 0;
      }
      return next;
    });
  };

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('gghl_forms', JSON.stringify(forms));
  }, [forms]);

  useEffect(() => {
    localStorage.setItem('gghl_shift_state', JSON.stringify(shift));
  }, [shift]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Set default active form when shift status changes or forms list changes
  useEffect(() => {
    if (shift.status === 'started' && !shift.activeFormId) {
      const mainForm = forms.find(f => f.category === 'main');
      if (mainForm) {
        setShift(prev => ({ ...prev, activeFormId: mainForm.id }));
      }
    } else if (shift.status === 'finishing' && (!shift.activeFormId || !forms.find(f => f.id === shift.activeFormId && f.category === 'finish'))) {
      const finishForm = forms.find(f => f.category === 'finish');
      if (finishForm) {
        setShift(prev => ({ ...prev, activeFormId: finishForm.id }));
      }
    }
  }, [shift.status, forms]);

  // --- TOAST TRIGGER ---
  const triggerToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // --- ADMIN AUTHENTICATION ---
  const handleAuth = () => {
    if (passcode === '1234' || passcode.toLowerCase() === 'dhl123' || passcode.toLowerCase() === 'dhl2026') {
      setIsAdminAuthorized(true);
      localStorage.setItem('dhl_admin_authorized', 'true');
      setPasscode('');
      setPasscodeError(false);
      triggerToast('Administrator authenticated successfully.', 'success');
    } else {
      setPasscodeError(true);
      triggerToast('Incorrect passcode.', 'error');
    }
  };

  // --- WORKFLOW ACTIONS ---
  const startShift = () => {
    const mainForm = forms.find(f => f.category === 'main');
    const now = new Date().toLocaleString();
    setShift({
      status: 'started',
      startTime: now,
      endTime: null,
      selectedSecondaryIds: [],
      activeFormId: mainForm ? mainForm.id : null,
    });
    triggerToast('DHL Logistics Shift Started! Drive safely.', 'success');
  };

  const selectSecondaryForm = (formId: string) => {
    setShift(prev => {
      const ids = prev.selectedSecondaryIds.includes(formId)
        ? prev.selectedSecondaryIds
        : [...prev.selectedSecondaryIds, formId];
      return {
        ...prev,
        selectedSecondaryIds: ids,
        activeFormId: formId,
      };
    });
    const form = forms.find(f => f.id === formId);
    if (form) {
      triggerToast(`Loaded: ${form.title}`, 'info');
    }
  };

  const switchActiveForm = (formId: string) => {
    setShift(prev => ({ ...prev, activeFormId: formId }));
  };

  const removeSecondaryFromTabs = (formId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShift(prev => {
      const nextIds = prev.selectedSecondaryIds.filter(id => id !== formId);
      // If we are closing the current active form, fall back to main sheet
      const mainForm = forms.find(f => f.category === 'main');
      const nextActiveId = prev.activeFormId === formId
        ? (mainForm ? mainForm.id : null)
        : prev.activeFormId;
      return {
        ...prev,
        selectedSecondaryIds: nextIds,
        activeFormId: nextActiveId,
      };
    });
  };

  const goToFinishShift = () => {
    const finishForm = forms.find(f => f.category === 'finish');
    setShift(prev => ({
      ...prev,
      status: 'finishing',
      activeFormId: finishForm ? finishForm.id : null,
    }));
    triggerToast('Review your finish-shift summary forms.', 'info');
  };

  const confirmFinishShift = () => {
    setShift(prev => ({
      ...prev,
      status: 'completed',
      endTime: new Date().toLocaleString(),
    }));
    triggerToast('Shift completed and finalized successfully!', 'success');
  };

  const resetShiftWorkflow = () => {
    setShift({
      status: 'idle',
      startTime: null,
      endTime: null,
      selectedSecondaryIds: [],
      activeFormId: null,
    });
    triggerToast('Workflow reset. Ready for a new shift.', 'info');
  };

  // --- FORM MANAGEMENT ACTIONS ---
  const addForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormTitle.trim() || !newFormUrl.trim()) {
      triggerToast('Please fill in all form details.', 'error');
      return;
    }

    // Clean up GoHighLevel url if it's missing protocol or is just a link
    let sanitizedUrl = newFormUrl.trim();
    if (!/^https?:\/\//i.test(sanitizedUrl)) {
      sanitizedUrl = 'https://' + sanitizedUrl;
    }

    const newForm: FormConfig = {
      id: `custom-${Date.now()}`,
      title: newFormTitle.trim(),
      url: sanitizedUrl,
      category: newFormCategory,
    };

    setForms(prev => [...prev, newForm]);
    setNewFormTitle('');
    setNewFormUrl('');
    triggerToast(`Added form: ${newForm.title}`, 'success');
  };

  const deleteForm = (id: string) => {
    const formToDelete = forms.find(f => f.id === id);
    if (formToDelete?.isDefault) {
      triggerToast('Cannot delete default forms, but you can add your own custom forms!', 'error');
      return;
    }

    setForms(prev => prev.filter(f => f.id !== id));
    // Fall back active form if deleted
    if (shift.activeFormId === id) {
      const mainForm = forms.find(f => f.category === 'main' && f.id !== id);
      setShift(prev => ({
        ...prev,
        activeFormId: mainForm ? mainForm.id : null,
        selectedSecondaryIds: prev.selectedSecondaryIds.filter(sid => sid !== id),
      }));
    }
    triggerToast('Form deleted successfully.', 'info');
  };

  const resetToDefaultForms = () => {
    if (window.confirm('Are you sure you want to restore default form links? This will reset all your customizations.')) {
      setForms(DEFAULT_FORMS);
      triggerToast('Restored default form links.', 'info');
    }
  };

  // Filter forms by category
  const mainForms = forms.filter(f => f.category === 'main');
  const secondaryForms = forms.filter(f => f.category === 'secondary');
  const finishForms = forms.filter(f => f.category === 'finish');

  // Currently rendered forms in "keep-alive" DOM
  // We keep the main sheets and selected secondary sheets mounted so their iframe state remains perfect!
  const mountedShiftForms = [
    ...mainForms,
    ...forms.filter(f => f.category === 'secondary' && shift.selectedSecondaryIds.includes(f.id)),
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-900">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer select-none active:scale-95 transition-transform duration-100"
            title="DHL Driver Portal"
          >
            {!logoError ? (
              <div className="flex items-center gap-3">
                <div className="h-10 bg-white px-3 py-1.5 rounded-xl flex items-center justify-center shadow-md shadow-black/20 border border-slate-700">
                  <img 
                    src="/assets/input_file_1081_cropped.png" 
                    alt="DHL Logo" 
                    className="h-6 md:h-7 w-auto object-contain" 
                    onError={() => setLogoError(true)} 
                  />
                </div>
                <div>
                  <h1 className="text-sm md:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                    DHL Driver Portal
                    <span className="hidden sm:inline-block px-1.5 py-0.5 text-[8px] uppercase font-bold tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                      Logistics
                    </span>
                  </h1>
                  <p className="text-[10px] text-slate-400 font-mono hidden sm:block">GoHighLevel Workspace</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-950/30">
                  <Clipboard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                    DHL Driver Portal
                    <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                      Logistics
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 font-mono hidden sm:block">Dynamic GoHighLevel Integration</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Status Pill */}
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 text-xs font-medium">
              <span className={`h-2.5 w-2.5 rounded-full ${
                shift.status === 'started' ? 'bg-emerald-500 animate-pulse' :
                shift.status === 'finishing' ? 'bg-amber-500 animate-pulse' :
                shift.status === 'completed' ? 'bg-blue-500' : 'bg-slate-600'
              }`} />
              <span className="text-slate-300 font-mono uppercase text-[11px]">
                {shift.status === 'idle' && 'Not Started'}
                {shift.status === 'started' && 'Shift Active'}
                {shift.status === 'finishing' && 'Finishing Shift'}
                {shift.status === 'completed' && 'Shift Finished'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* --- TOAST NOTIFICATIONS --- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-18 right-4 left-4 sm:left-auto sm:w-96 z-50 pointer-events-none"
          >
            <div className={`p-4 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
              toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200' :
              toast.type === 'info' ? 'bg-slate-950/90 border-slate-800 text-slate-200' :
              'bg-red-950/90 border-red-800 text-red-200'
            }`}>
              <div className="mt-0.5">
                {toast.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                {toast.type === 'info' && <Info className="h-5 w-5 text-blue-400" />}
                {toast.type === 'error' && <AlertTriangle className="h-5 w-5 text-red-400" />}
              </div>
              <div className="flex-1 text-sm font-medium">{toast.message}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MAIN PAGE CONTENT --- */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col gap-6">

        {/* --- STAGE 1: IDLE / NOT STARTED --- */}
        {shift.status === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 md:py-24">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-2xl bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl text-center backdrop-blur-sm relative overflow-hidden"
            >
              {/* Decorative light ring */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent blur-sm" />
              
              <div className="flex justify-center mb-6">
                {!logoError ? (
                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-700 inline-flex items-center justify-center max-w-[220px]">
                    <img 
                      src="/assets/input_file_1081_cropped.png" 
                      alt="DHL Logo" 
                      className="h-10 md:h-12 w-auto object-contain" 
                      onError={() => setLogoError(true)} 
                    />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-950/30">
                    <Clipboard className="h-8 w-8 text-white" />
                  </div>
                )}
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/50 mb-6">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Driver Workflow
              </span>

              <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                DHL Run Shift Manager
              </h2>
              <p className="mt-3 text-slate-400 text-sm md:text-base max-w-lg mx-auto">
                Begin your run shift. This will load the primary Driver Run Sheet and unlock your secondary checksheets dynamically.
              </p>

              {/* Preloaded configuration preview */}
              <div className="mt-8 mb-8 p-4 bg-slate-950/60 rounded-2xl border border-slate-850 text-left">
                <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2.5 font-mono flex items-center justify-between">
                  <span>Forms configured for this shift</span>
                  <span className="text-[10px] text-emerald-400 font-normal normal-case">Edit anytime in settings</span>
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-emerald-950 text-emerald-400 rounded">Main</span>
                    <span className="font-semibold truncate">{mainForms[0]?.title || 'Driver Run Sheet'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-900/40 rounded-lg border border-slate-800 truncate text-slate-400">
                      📋 {secondaryForms.length} Secondary Form{secondaryForms.length !== 1 && 's'}
                    </div>
                    <div className="p-2 bg-slate-900/40 rounded-lg border border-slate-800 truncate text-slate-400">
                      🏁 {finishForms.length} Finish Form{finishForms.length !== 1 && 's'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Large Start Button */}
              <button
                onClick={startShift}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-lg shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/50 transform hover:-translate-y-0.5 active:translate-y-0 transition duration-150 cursor-pointer"
                id="btn-start-shift"
              >
                <Play className="h-5 w-5 fill-current text-white" />
                START DHL SHIFT
              </button>
            </motion.div>
          </div>
        )}

        {/* --- STAGE 2: ACTIVE SHIFT --- */}
        {shift.status === 'started' && (
          <div className="flex-1 flex flex-col gap-4">
            
            {/* Shift Tracker Ribbon */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-950 border border-emerald-800/40 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">Active Shift Duration</div>
                  <div className="text-sm font-semibold text-white">
                    Started at <span className="text-emerald-400 font-mono font-normal">{shift.startTime}</span>
                  </div>
                </div>
              </div>

              {/* Secondary Forms Selection Dropdown */}
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative group w-full sm:w-64">
                  <label className="sr-only">Secondary Forms</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        selectSecondaryForm(e.target.value);
                        e.target.value = ''; // Reset dropdown after selection
                      }
                    }}
                    defaultValue=""
                    className="w-full appearance-none px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-sm font-semibold pr-10 focus:outline-none focus:border-emerald-500 transition duration-150 cursor-pointer"
                  >
                    <option value="" disabled>➕ Request Secondary Form...</option>
                    {secondaryForms.map((form) => (
                      <option key={form.id} value={form.id}>
                        {form.title}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>

                <button
                  onClick={goToFinishShift}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/20"
                  id="btn-goto-finish"
                >
                  <Square className="h-4 w-4 fill-current text-slate-950" />
                  Finish Shift Workflow
                </button>
              </div>
            </div>

            {/* Navigation Tabs (Keep-Alive Form Switchers) */}
            <div className="flex items-center overflow-x-auto gap-2 pb-1 border-b border-slate-800 scrollbar-thin scrollbar-thumb-slate-800">
              
              {/* Main Sheet Tab (Always present) */}
              {mainForms.map((form) => {
                const isActive = shift.activeFormId === form.id;
                return (
                  <button
                    key={form.id}
                    onClick={() => switchActiveForm(form.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold whitespace-nowrap transition duration-150 cursor-pointer ${
                      isActive 
                        ? 'bg-slate-800 text-white border-t-2 border-emerald-500' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {form.title}
                  </button>
                );
              })}

              {/* Dynamically opened secondary forms tabs */}
              {forms
                .filter(f => f.category === 'secondary' && shift.selectedSecondaryIds.includes(f.id))
                .map((form) => {
                  const isActive = shift.activeFormId === form.id;
                  return (
                    <div
                      key={form.id}
                      className={`flex items-center rounded-t-xl overflow-hidden transition duration-150 ${
                        isActive ? 'bg-slate-800 text-white border-t-2 border-emerald-500' : 'text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      <button
                        onClick={() => switchActiveForm(form.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 text-sm font-bold whitespace-nowrap transition duration-150 cursor-pointer`}
                      >
                        <FileText className="h-4 w-4 text-emerald-500" />
                        {form.title}
                      </button>
                      <button
                        onClick={(e) => removeSecondaryFromTabs(form.id, e)}
                        className="p-1.5 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 mr-1 rounded-md transition cursor-pointer"
                        title="Close form tab (preserves session)"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Keep-Alive Form Display */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 relative min-h-[660px] md:min-h-[820px] flex flex-col justify-between">
              
              <div className="absolute top-2 right-4 z-10 flex items-center gap-2">
                <button
                  onClick={() => {
                    const activeIframe = document.getElementById(`iframe-${shift.activeFormId}`) as HTMLIFrameElement;
                    if (activeIframe) {
                      activeIframe.src = activeIframe.src;
                      triggerToast('Reloaded active form.', 'info');
                    }
                  }}
                  className="p-1.5 rounded bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white transition duration-150 cursor-pointer"
                  title="Reload Form Session"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="w-full flex-1">
                {mountedShiftForms.map((form) => {
                  const isVisible = shift.activeFormId === form.id;
                  return (
                    <div 
                      key={form.id} 
                      className={`w-full h-full ${isVisible ? 'block' : 'hidden'}`}
                    >
                      <div className="p-2 text-xs text-slate-400 flex items-center justify-between border-b border-slate-900 mb-2">
                        <span className="font-mono">Secure Connection: leadconnectorhq.com ({form.title})</span>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Keep-Alive Session Active
                        </span>
                      </div>
                      <iframe 
                        id={`iframe-${form.id}`}
                        src={form.url}
                        className="w-full h-[620px] md:h-[780px] border-0 rounded-xl bg-white shadow-2xl"
                        title={form.title}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                      />
                    </div>
                  );
                })}

                {/* Fallback if active form is somehow missing or not loaded */}
                {!shift.activeFormId && (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-6">
                    <AlertTriangle className="h-10 w-10 text-emerald-500 mb-4 animate-bounce" />
                    <h3 className="text-lg font-bold">No Active Form Loaded</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-sm">
                      Select Driver Run Sheet or choose a secondary form from the menu to populate your workflow workspace.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* --- STAGE 3: FINISHING SHIFT FORMS --- */}
        {shift.status === 'finishing' && (
          <div className="flex-1 flex flex-col gap-4">
            
            {/* Completion header bar */}
            <div className="bg-amber-950/40 border border-amber-900/50 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 bg-amber-950 text-amber-400 border border-amber-800/40 rounded-xl">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-200">Finishing DHL Run</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Please fill out the post-shift summary forms below to finalize your records.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <button
                  onClick={() => setShift(prev => ({ ...prev, status: 'started' }))}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Go Back to Active Shift
                </button>
                <button
                  onClick={confirmFinishShift}
                  className="flex-1 md:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/30"
                  id="btn-confirm-finish"
                >
                  <CheckCircle className="h-4 w-4 text-white" />
                  Confirm Shift End
                </button>
              </div>
            </div>

            {/* Navigation Tabs for Finish Stage */}
            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
              {finishForms.map((form) => {
                const isActive = shift.activeFormId === form.id;
                return (
                  <button
                    key={form.id}
                    onClick={() => switchActiveForm(form.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold whitespace-nowrap transition duration-150 cursor-pointer ${
                      isActive 
                        ? 'bg-slate-800 text-white border-t-2 border-emerald-500' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {form.title}
                  </button>
                );
              })}

              {finishForms.length === 0 && (
                <div className="text-xs text-slate-400 py-1 font-mono">
                  No post-shift summary forms configured. Feel free to add some in Admin settings.
                </div>
              )}
            </div>

            {/* Display Iframe for Finish Forms */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 relative min-h-[660px] md:min-h-[820px] flex flex-col">
              {finishForms.map((form) => {
                const isVisible = shift.activeFormId === form.id;
                return (
                  <div 
                    key={form.id} 
                    className={`w-full h-full flex-1 ${isVisible ? 'block' : 'hidden'}`}
                  >
                    <div className="p-2 text-xs text-slate-400 flex items-center justify-between border-b border-slate-900 mb-2">
                      <span className="font-mono">Finishing Record Panel: ({form.title})</span>
                    </div>
                    <iframe 
                      src={form.url}
                      className="w-full h-[620px] md:h-[780px] border-0 rounded-xl bg-white shadow-2xl"
                      title={form.title}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    />
                  </div>
                );
              })}

              {finishForms.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[500px] text-center p-6">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                  <h3 className="text-lg font-bold">No Summary Forms Needed</h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm">
                    You can immediately click the "Confirm Shift End" button above to finalize your DHL shift records.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* --- STAGE 4: SHIFT COMPLETED / CONFIRMATION --- */}
        {shift.status === 'completed' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 md:py-24">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-10 text-center relative overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
              
              <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>

              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Shift Finalized Successfully!
              </h2>
              <p className="text-slate-400 text-sm mt-2">
                All records, checklists, and summary sheets have been registered. Thank you for completing your DHL Run.
              </p>

              {/* Shift metrics logs summary */}
              <div className="mt-8 mb-8 p-4 bg-slate-900/50 rounded-2xl border border-slate-850/80 text-left space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800">
                  <span className="text-slate-500 uppercase font-bold">Driver ID Profile</span>
                  <span className="text-slate-200">Authenticated (GHL Session)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800">
                  <span className="text-slate-500 uppercase font-bold">Shift Start Time</span>
                  <span className="text-slate-200">{shift.startTime}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800">
                  <span className="text-slate-500 uppercase font-bold">Shift End Time</span>
                  <span className="text-slate-200">{shift.endTime}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 uppercase font-bold">Run Sheet Status</span>
                  <span className="text-emerald-400 font-bold uppercase flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full" /> Submitted / Confirmed
                  </span>
                </div>
              </div>

              <button
                onClick={resetShiftWorkflow}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl transition duration-150 cursor-pointer"
                id="btn-new-shift"
              >
                <RotateCcw className="h-4 w-4" />
                Initialize New Shift
              </button>
            </motion.div>
          </div>
        )}

      </main>

      {/* --- FOOTER --- */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/40 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span 
              className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse cursor-pointer" 
              onClick={() => setIsAdminOpen(true)} 
              title="Operational Status" 
            />
            <span>Operational Run Sheet Workspace — Licensed GHL Forms integration.</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <span>Powered by Google AI Studio • Active Session Persistence</span>
            <span 
              className="text-slate-850 hover:text-emerald-500/30 transition text-[9px] cursor-pointer select-none font-mono ml-1" 
              onClick={() => setIsAdminOpen(true)}
            >
              [Staff Control v2.4]
            </span>
          </div>
        </div>
      </footer>

      {/* --- ADMIN MODAL / SLIDE-OVER (FORM MANAGER) --- */}
      <AnimatePresence>
        {isAdminOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            
            {/* Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminOpen(false)}
              className="absolute inset-0 bg-black cursor-pointer"
            />

            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-10"
            >
              
              {/* Sidebar Header */}
              <div className="p-4 md:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Manage Form Links</h2>
                </div>
                <button
                  onClick={() => setIsAdminOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Sidebar Content */}
              {!isAdminAuthorized ? (
                <div className="flex-1 flex flex-col justify-center p-6 md:p-8 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="h-14 w-14 bg-emerald-950/60 border border-emerald-800/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Lock className="h-7 w-7 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">DHL Administration Gate</h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Access to GHL Form Configurator and route settings is restricted to coordinators.
                    </p>
                  </div>

                  <div className="space-y-4 bg-slate-950/50 p-5 rounded-2xl border border-slate-850">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">Enter Admin Passcode</label>
                      <input
                        type="password"
                        placeholder="••••"
                        value={passcode}
                        onChange={(e) => {
                          setPasscode(e.target.value);
                          setPasscodeError(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAuth();
                          }
                        }}
                        className={`w-full px-3 py-2.5 bg-slate-900 border ${
                          passcodeError ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-emerald-500'
                        } rounded-xl text-center text-lg tracking-widest text-white placeholder-slate-600 focus:outline-none transition`}
                      />
                      {passcodeError && (
                        <p className="text-[11px] text-red-400 mt-1.5 text-center font-medium">❌ Invalid admin passcode. Try 1234.</p>
                      )}
                    </div>

                    <button
                      onClick={handleAuth}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/20"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Authenticate Credentials
                    </button>
                  </div>

                  {/* Demo/Pitch Assistant Mode - Highly Sleek */}
                  <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-900/30 text-center space-y-2">
                    <div className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider font-mono">Demo Pitch Mode Active</div>
                    <p className="text-[11px] text-slate-400">
                      Use passcode <strong className="text-emerald-400 font-mono">1234</strong> or click the bypass button below to demonstrate layout changes instantly.
                    </p>
                    <button
                      onClick={() => {
                        setIsAdminAuthorized(true);
                        localStorage.setItem('dhl_admin_authorized', 'true');
                        triggerToast('Demo Bypass: Welcome Coordinator!', 'success');
                      }}
                      className="px-3 py-1.5 bg-slate-850 hover:bg-slate-750 border border-slate-700 text-emerald-400 text-[11px] font-bold rounded-lg transition duration-150 inline-flex items-center gap-1 cursor-pointer"
                    >
                      ⚡ Quick Pitch Bypass
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
                    
                    {/* Information Card */}
                    <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
                      <h3 className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Info className="h-4 w-4 text-emerald-400" />
                        How It Works
                      </h3>
                      <p>
                        GoHighLevel forms rely on secure sessions for driver run sheets. You can add, remove, and swap out the embedded forms dynamically.
                      </p>
                      <p className="font-semibold text-emerald-400">
                        💡 All changes persist locally on your device instantly.
                      </p>
                    </div>

                    {/* Add Form Section */}
                    <form onSubmit={addForm} className="space-y-4">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">➕ Add New Form Link</h3>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Form Name / Title</label>
                          <input
                            type="text"
                            placeholder="e.g. Fuel Purchase Log"
                            value={newFormTitle}
                            onChange={(e) => setNewFormTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">GoHighLevel Embed URL</label>
                          <input
                            type="text"
                            placeholder="https://api.leadconnectorhq.com/widget/form/..."
                            value={newFormUrl}
                            onChange={(e) => setNewFormUrl(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Form Stage / Category</label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setNewFormCategory('main')}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition duration-150 cursor-pointer text-center ${
                                newFormCategory === 'main'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-850'
                              }`}
                            >
                              Main Sheet
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewFormCategory('secondary')}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition duration-150 cursor-pointer text-center ${
                                newFormCategory === 'secondary'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-850'
                              }`}
                            >
                              Secondary
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewFormCategory('finish')}
                              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition duration-150 cursor-pointer text-center ${
                                newFormCategory === 'finish'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-850'
                              }`}
                            >
                              Finish Shift
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        Register Form Link
                      </button>
                    </form>

                    {/* Form Lists */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">📋 Currently Registered Forms</h3>
                        <button
                          onClick={resetToDefaultForms}
                          className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore Defaults
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Main Forms list */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Main Sheet Forms</div>
                          {mainForms.map((form) => (
                            <div key={form.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850">
                              <div className="truncate pr-4">
                                <div className="text-sm font-bold text-slate-200 truncate">{form.title}</div>
                                <div className="text-[10px] text-slate-500 font-mono truncate">{form.url}</div>
                              </div>
                              <span className="shrink-0 px-2 py-0.5 text-[9px] font-bold bg-emerald-950 text-emerald-400 rounded">
                                Active
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Secondary Forms list */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Secondary Checksheets</div>
                          {secondaryForms.length === 0 ? (
                            <div className="text-xs text-slate-500 italic p-2">No secondary forms added.</div>
                          ) : (
                            secondaryForms.map((form) => (
                              <div key={form.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850">
                                <div className="truncate pr-4">
                                  <div className="text-sm font-bold text-slate-200 truncate">{form.title}</div>
                                  <div className="text-[10px] text-slate-500 font-mono truncate">{form.url}</div>
                                </div>
                                {!form.isDefault && (
                                  <button
                                    onClick={() => deleteForm(form.id)}
                                    className="shrink-0 p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Finish Shift Forms list */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Finish-Shift Summaries</div>
                          {finishForms.length === 0 ? (
                            <div className="text-xs text-slate-500 italic p-2">No finish-shift forms added.</div>
                          ) : (
                            finishForms.map((form) => (
                              <div key={form.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850">
                                <div className="truncate pr-4">
                                  <div className="text-sm font-bold text-slate-200 truncate">{form.title}</div>
                                  <div className="text-[10px] text-slate-500 font-mono truncate">{form.url}</div>
                                </div>
                                {!form.isDefault && (
                                  <button
                                    onClick={() => deleteForm(form.id)}
                                    className="shrink-0 p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </>
              )}

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-slate-850 bg-slate-950 flex gap-2.5">
                {isAdminAuthorized && (
                  <button
                    onClick={() => {
                      setIsAdminAuthorized(false);
                      localStorage.removeItem('dhl_admin_authorized');
                      triggerToast('Admin panel locked.', 'info');
                    }}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    title="Lock Admin Control"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Lock Panel
                  </button>
                )}
                <button
                  onClick={() => setIsAdminOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-white text-sm font-bold rounded-xl transition cursor-pointer"
                >
                  Done Editing
                </button>
              </div>

            </motion.div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
