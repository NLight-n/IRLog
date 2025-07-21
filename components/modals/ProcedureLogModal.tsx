import React, { useState, useEffect, useRef } from 'react';
import { FiClock } from 'react-icons/fi';

const defaultForm = {
  procedureID: '',
  patientID: '',
  patientName: '',
  patientAge: '',
  patientSex: '',
  procedureName: '',
  status: '',
  modality: '',
  procedureDate: '',
  procedureTime: '',
  diagnosis: '',
  procedureNotesText: '',
  procedureCost: '',
  doneBy: [],
  refPhysician: '',
  followUp: '',
  procedureNotesFilePath: '',
  // add other fields as needed
};

function getCurrentDate() {
  return new Date().toISOString().slice(0, 10);
}
function getCurrentTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

export default function ProcedureLogModal({ open, onClose, onSave, onDelete, initialData, userPermissions, viewOnly = false, onEdit, navbarHeight = 0 }: { open: boolean; onClose: () => void; onSave: (form: any) => void; onDelete: (id: string) => void; initialData: any; userPermissions: any; viewOnly: boolean; onEdit: () => void; navbarHeight: number }) {
  const [form, setForm] = useState<any>(initialData ?? { ...defaultForm, procedureDate: getCurrentDate(), procedureTime: getCurrentTime() });
  const [procedures, setProcedures] = useState<any[]>([]);
  const [physicians, setPhysicians] = useState<any[]>([]);
  const [procedureSearch, setProcedureSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [currency, setCurrency] = useState('$');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState('24hr');
  const doneByInputRef = useRef<HTMLInputElement>(null);
  const [showDoneByDropdown, setShowDoneByDropdown] = useState(false);
  const referrerPhysicians = physicians.filter((p: any) => (p.role || '').toLowerCase() === 'referrer');
  const refPhysicianInputRef = useRef<HTMLInputElement>(null);
  const [refPhysicianSearch, setRefPhysicianSearch] = useState('');
  const [showRefPhysicianDropdown, setShowRefPhysicianDropdown] = useState(false);
  const filteredRefPhysicians = refPhysicianSearch
    ? referrerPhysicians.filter((p: any) => p.name.toLowerCase().includes(refPhysicianSearch.toLowerCase()))
    : referrerPhysicians;
  const [procedureDropdownIndex, setProcedureDropdownIndex] = useState(-1);
  const [doneByDropdownIndex, setDoneByDropdownIndex] = useState(-1);
  const [refPhysicianDropdownIndex, setRefPhysicianDropdownIndex] = useState(-1);

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    // Always parse as UTC and display only the date part
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }

  function formatTime(timeStr: string) {
    if (!timeStr) return '';
    if (timeFormat === '12hr') {
      // Assume timeStr is HH:mm or HH:mm:ss
      const [h, m] = timeStr.split(':');
      let hour = parseInt(h, 10);
      const min = m;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;
      return `${hour}:${min} ${ampm}`;
    }
    // Default: 24hr
    return timeStr;
  }

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
      setIsEditing(false);
      setProcedureSearch('');
      setRefPhysicianSearch('');
    } else {
      setForm({ ...defaultForm, procedureDate: getCurrentDate(), procedureTime: getCurrentTime() });
      setIsEditing(true);
      setProcedureSearch('');
      setRefPhysicianSearch('');
    }
  }, [initialData]);

  useEffect(() => {
    if (open) {
      fetch(`/api/procedures/list-all?_=${Date.now()}`)
        .then(r => r.json())
        .then(list => {
          if (Array.isArray(list)) {
            setProcedures(list);
          } else {
            setProcedures([]);
          }
        })
        .catch(() => setProcedures([]));
      fetch('/api/procedures/physician')
        .then(r => r.json())
        .then(list => {
          if (Array.isArray(list)) {
            setPhysicians(list);
          } else {
            setPhysicians([]);
          }
        })
        .catch(() => setPhysicians([]));
    }
  }, [open]);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.currency) setCurrency(data.currency);
        if (data.dateFormat) setDateFormat(data.dateFormat);
        if (data.timeFormat) setTimeFormat(data.timeFormat);
      });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (viewOnly && !isEditing) return;
    const { name, value } = e.target;
    setForm((f: any) => ({ ...f, [name]: value }));
  };

  const handleProcedureSelect = (proc: any) => {
    setForm((f: any) => ({
      ...f,
      procedureName: proc.procedureName,
      procedureCost: proc.procedureCost ?? '',
    }));
    setDropdownOpen(false);
    setProcedureSearch('');
  };

  // Sort procedures alphabetically by procedureName for the dropdown
  const sortedProcedures = [...procedures].sort((a, b) => a.procedureName.localeCompare(b.procedureName));
  const filteredProcedures = procedureSearch
    ? sortedProcedures.filter((p: any) => p.procedureName.toLowerCase().includes(procedureSearch.toLowerCase()))
    : sortedProcedures.slice(0, 20);

  const selectedProcedure = Array.isArray(procedures) && form ? procedures.find(p => p.proID === Number(form.procedureRef)) : undefined;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewOnly) return;
    // Required fields
    const requiredFields = [
      'patientID',
      'patientName',
      'patientAge',
      'patientSex',
      'procedureName',
      'status',
      'modality',
      'procedureDate',
      'procedureTime',
      'doneBy',
      'refPhysician',
    ];
    for (const field of requiredFields) {
      if (!form[field] || (Array.isArray(form[field]) && form[field].length === 0)) {
        setError('Please fill all required fields.');
        return;
      }
    }
    setError('');
    // Ensure only shortform is saved for status and modality
    const statusShort = STATUS_OPTIONS.find(opt => opt.value === form.status) ? form.status : STATUS_OPTIONS[0].value;
    const modalityShort = MODALITY_OPTIONS.find(opt => opt.value === form.modality) ? form.modality : MODALITY_OPTIONS[0].value;
    onSave({ ...form, status: statusShort, modality: modalityShort });
  };

  useEffect(() => {
    if (!open || (viewOnly && !isEditing && initialData)) return;

    function handleShortcut(e: KeyboardEvent) {
      // Save: Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        // Call your save handler
        // We need a synthetic event for handleSave
        if (typeof handleSave === 'function') {
          handleSave({ preventDefault: () => {} } as any);
        }
      }
      // Cancel: Esc
      if (e.key === 'Escape') {
        e.preventDefault();
        if (typeof onClose === 'function') onClose();
      }
      // Clear Form: Ctrl+Shift+C or Cmd+Shift+C (only for new entry)
      if (!initialData && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setForm({ ...defaultForm, procedureDate: '', procedureTime: '', refPhysician: '' });
        setRefPhysicianSearch('');
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewOnly, isEditing, initialData, handleSave, onClose]);

  if (!open) return null;

  const idToDelete = initialData?.procedureID || form?.procedureID;

  const irPhysicians = physicians.filter((p: any) => (p.role || '').toLowerCase() === 'ir');
  const selectedDoneBy = irPhysicians.filter((phy: any) => (form?.doneBy || []).includes(phy.physicianID));

  const STATUS_OPTIONS = [
    { value: 'IP', label: 'Inpatient (IP)' },
    { value: 'OP', label: 'Outpatient (OP)' },
  ];
  const MODALITY_OPTIONS = [
    { value: 'USG', label: 'Ultrasound (USG)' },
    { value: 'CT', label: 'Computed Tomography (CT)' },
    { value: 'OT', label: 'Operating Theater (OT)' },
    { value: 'XF', label: 'X-ray Fluoroscopy (XF)' },
    { value: 'DSA', label: 'Digital Subtraction Angiography (DSA)' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="card max-w-4xl w-full mx-4 procedure-log-modal"
        style={{
          position: 'absolute',
          top: navbarHeight + 8,
          left: 0,
          right: 0,
          margin: '0 auto',
          maxHeight: `calc(100vh - ${navbarHeight + 16}px)`,
          overflowY: 'auto',
        }}
      >
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {initialData && initialData.procedureID ? ((viewOnly && !isEditing) ? 'Procedure Details' : 'Edit') : 'New Registry Entry'}
          </h3>
          <div className="flex items-center gap-2">
            {(viewOnly && !isEditing && userPermissions?.editProcedureLog) && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit ? onEdit() : setIsEditing(true)}
                  className="btn btn-primary btn-sm"
                  style={{marginRight: 4}}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn btn-danger btn-sm"
                  style={{marginRight: 4}}
                >
                  Delete
                </button>
              </>
            )}
            {(viewOnly && !isEditing) && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-2 text-gray-500 hover:text-gray-800 text-2xl font-bold focus:outline-none"
                style={{ lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </div>
        </div>
        
        <form onSubmit={handleSave} className="card-body" style={{ paddingBottom: navbarHeight + 8 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Patient Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 border-b pb-2">Patient Information</h4>
              
              <div className="form-group">
                <label className="form-label">Patient ID</label>
                {(viewOnly && !isEditing) ? (
                  <div className="form-input bg-gray-50">{form?.patientID}</div>
                ) : (
                  <input 
                    name="patientID" 
                    value={form?.patientID || ''} 
                    onChange={handleChange} 
                    required 
                    className="form-input"
                    placeholder="Enter patient ID"
                  />
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label">Patient Name</label>
                {(viewOnly && !isEditing) ? (
                  <div className="form-input bg-gray-50">{form?.patientName}</div>
                ) : (
                  <input 
                    name="patientName" 
                    value={form?.patientName || ''} 
                    onChange={handleChange} 
                    required 
                    className="form-input"
                    placeholder="Enter patient name"
                  />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Age</label>
                  {(viewOnly && !isEditing) ? (
                    <div className="form-input bg-gray-50">{form?.patientAge}</div>
                  ) : (
                    <input 
                      name="patientAge" 
                      value={form?.patientAge || ''} 
                      onChange={handleChange} 
                      required 
                      className="form-input"
                      placeholder="Age"
                    />
                  )}
                </div>
                
                <div className="form-group">
                  <label className="form-label">Sex</label>
                  {(viewOnly && !isEditing) ? (
                    <div className="form-input bg-gray-50">{form?.patientSex}</div>
                  ) : (
                    <select 
                      name="patientSex" 
                      value={form?.patientSex || ''} 
                      onChange={handleChange} 
                      required 
                      className="form-select"
                    >
                      <option value="">Select</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="O">Other</option>
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Procedure Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 border-b pb-2">Procedure Information</h4>
              
              <div className="form-group">
                <label className="form-label">Procedure</label>
                <div className="relative" ref={dropdownRef}>
                  <input
                    type="text"
                    placeholder="Search procedure..."
                    value={procedureSearch !== '' ? procedureSearch : form.procedureName || ''}
                    onChange={e => {
                      setProcedureSearch(e.target.value);
                      setForm((f: any) => ({ ...f, procedureName: e.target.value }));
                      if (!(viewOnly && !isEditing)) setDropdownOpen(true);
                      setProcedureDropdownIndex(0);
                    }}
                    onFocus={() => { if (!(viewOnly && !isEditing)) setDropdownOpen(true); }}
                    className="form-input"
                    autoComplete="off"
                    readOnly={viewOnly && !isEditing}
                    onKeyDown={e => {
                      if (!dropdownOpen || viewOnly) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setProcedureDropdownIndex(i => Math.min(i + 1, filteredProcedures.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setProcedureDropdownIndex(i => Math.max(i - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredProcedures[procedureDropdownIndex]) {
                          setForm((f: any) => ({ ...f, procedureName: filteredProcedures[procedureDropdownIndex].procedureName, procedureCost: filteredProcedures[procedureDropdownIndex].procedureCost ?? '' }));
                          setDropdownOpen(false);
                          setProcedureSearch('');
                        }
                      } else if (e.key === 'Escape' || e.key === 'Tab') {
                        setDropdownOpen(false);
                      }
                    }}
                  />
                  {dropdownOpen && !viewOnly && filteredProcedures.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-60 overflow-y-auto">
                      {filteredProcedures.map((p: any, idx: number) => (
                        <div
                          key={p.proID}
                          className={`p-2 cursor-pointer hover:bg-gray-50 ${form?.procedureName === p.procedureName ? 'selected-accent' : ''} ${procedureDropdownIndex === idx ? 'selected-accent' : ''}`}
                          style={{ paddingLeft: '8px', paddingTop: '2px', paddingBottom: '2px', cursor: 'pointer' }}
                          onClick={() => {
                            setForm((f: any) => ({ ...f, procedureName: p.procedureName, procedureCost: p.procedureCost ?? '' }));
                            setDropdownOpen(false);
                            setProcedureSearch('');
                          }}
                          onMouseEnter={() => setProcedureDropdownIndex(idx)}
                        >
                          <div className="text-sm font-medium">{p.procedureName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Status field */}
                <div className="form-group">
                  <label className="form-label">Status</label>
                  {(viewOnly && !isEditing) ? (
                    <div className="form-input bg-gray-50">{form.status}</div>
                  ) : (
                    <select
                      name="status"
                      value={form.status || ''}
                      onChange={handleChange}
                      required
                      className="form-select"
                      disabled={viewOnly && !isEditing}
                    >
                      <option value="">Select Status</option>
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.value} - {opt.label.replace(/\s*\(.+\)/, '')}</option>
                      ))}
                    </select>
                  )}
                </div>
                {/* Modality field */}
                <div className="form-group">
                  <label className="form-label">Modality</label>
                  {(viewOnly && !isEditing) ? (
                    <div className="form-input bg-gray-50">{form.modality}</div>
                  ) : (
                    <select
                      name="modality"
                      value={form.modality || ''}
                      onChange={handleChange}
                      required
                      className="form-select"
                      disabled={viewOnly && !isEditing}
                    >
                      <option value="">Select Modality</option>
                      {MODALITY_OPTIONS.map(opt => {
                        const match = opt.label.match(/^([^(]+)\(([^)]+)\)$/);
                        const expanded = match ? match[1].trim() : opt.label;
                        return (
                          <option key={opt.value} value={opt.value}>{opt.value} - {expanded}</option>
                        );
                      })}
                    </select>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <div className="flex gap-2 items-center">
                    <input
                      name="procedureDate"
                      type="date"
                      value={form?.procedureDate ? form.procedureDate.slice(0, 10) : ''}
                      onChange={handleChange}
                      required
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <div className="flex gap-2 items-center">
                    <input
                      name="procedureTime"
                      type="time"
                      value={form?.procedureTime || ''}
                      onChange={handleChange}
                      required
                      className="form-input"
                    />
                    <button type="button" className="btn btn-sm btn-secondary" title="Now" onClick={() => {
                      const now = new Date();
                      setForm((f: any) => ({
                        ...f,
                        procedureDate: now.toISOString().slice(0, 10),
                        procedureTime: now.toTimeString().slice(0, 5),
                      }));
                    }}>
                      <FiClock size={18} style={{ verticalAlign: 'middle', color: 'var(--color-accent)' }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Done By and Ref Physician */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Done By Custom Multi-select (IR only) */}
            <div className="form-group relative">
              <label className="form-label">Done By</label>
              {(viewOnly && !isEditing) ? (
                <div className="form-input bg-gray-50 min-h-[2.5rem] flex flex-wrap items-center gap-1">
                  {selectedDoneBy.length === 0 ? (
                    <span className="text-gray-400">-</span>
                  ) : (
                    selectedDoneBy.map((phy: any) => phy.name).join(', ')
                  )}
                </div>
              ) : (
                <>
                  <div
                    className="form-input cursor-pointer min-h-[2.5rem] flex flex-wrap items-center gap-1"
                    tabIndex={0}
                    onClick={() => setShowDoneByDropdown(true)}
                    onFocus={() => setShowDoneByDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDoneByDropdown(false), 200)}
                    ref={doneByInputRef}
                    style={{ minHeight: '2.5rem' }}
                    onKeyDown={e => {
                      if (!showDoneByDropdown) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setDoneByDropdownIndex(i => Math.min(i + 1, irPhysicians.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setDoneByDropdownIndex(i => Math.max(i - 1, 0));
                      } else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (irPhysicians[doneByDropdownIndex]) {
                          setForm((f: any) => {
                            const ids = new Set(f.doneBy || []);
                            if (ids.has(irPhysicians[doneByDropdownIndex].physicianID)) {
                              ids.delete(irPhysicians[doneByDropdownIndex].physicianID);
                            } else {
                              ids.add(irPhysicians[doneByDropdownIndex].physicianID);
                            }
                            return { ...f, doneBy: Array.from(ids) };
                          });
                        }
                      } else if ((e.key === 'Enter' || e.key === ' ') && !showDoneByDropdown) {
                        setShowDoneByDropdown(true);
                      } else if (e.key === 'Escape' || e.key === 'Tab') {
                        setShowDoneByDropdown(false);
                      }
                    }}
                  >
                    {selectedDoneBy.length === 0 && <span className="text-gray-400">Select IR physicians...</span>}
                    {selectedDoneBy.map((phy: any) => (
                      <span key={phy.physicianID} className="selected-accent rounded px-2 py-0.5 text-xs flex items-center gap-1">
                        {phy.name}
                        <button
                          type="button"
                          className="ml-1 text-blue-800 hover:text-red-500"
                          onClick={e => {
                            e.stopPropagation();
                            setForm((f: any) => ({ ...f, doneBy: (f.doneBy || []).filter((id: number) => id !== phy.physicianID) }));
                          }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                  {showDoneByDropdown && (
                    <div className="absolute z-50 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded shadow max-h-60 overflow-y-auto w-full mt-1">
                      {irPhysicians.length === 0 && (
                        <div className="px-4 py-2 text-gray-500">No IR physicians</div>
                      )}
                      {irPhysicians.map((phy: any, idx: number) => {
                        const selected = (form?.doneBy || []).includes(phy.physicianID);
                        return (
                          <div
                            key={phy.physicianID}
                            className={`px-4 py-2 cursor-pointer flex items-center ${selected ? 'selected-accent font-bold' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100'} ${doneByDropdownIndex === idx ? 'selected-accent' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onMouseDown={() => {
                              setForm((f: any) => {
                                const ids = new Set(f.doneBy || []);
                                if (ids.has(phy.physicianID)) {
                                  ids.delete(phy.physicianID);
                                } else {
                                  ids.add(phy.physicianID);
                                }
                                return { ...f, doneBy: Array.from(ids) };
                              });
                            }}
                            onMouseEnter={() => setDoneByDropdownIndex(idx)}
                          >
                            <input type="checkbox" checked={selected} readOnly className="mr-2" />
                            {phy.name}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Ref Physician Custom Searchable Dropdown */}
            <div className="form-group relative">
              <label className="form-label">Referring Physician</label>
              {(viewOnly && !isEditing) ? (
                <div className="form-input bg-gray-50 min-h-[2.5rem] flex items-center">
                  {referrerPhysicians.find((p: any) => p.physicianID === form?.refPhysician)?.name || '-'}
                </div>
              ) : (
                <>
                  <input
                    ref={refPhysicianInputRef}
                    type="text"
                    className="form-input"
                    placeholder="Search physician..."
                    value={refPhysicianSearch !== '' ? refPhysicianSearch : (referrerPhysicians.find((p: any) => p.physicianID === form?.refPhysician)?.name || '')}
                    onFocus={() => setShowRefPhysicianDropdown(true)}
                    onChange={e => {
                      setRefPhysicianSearch(e.target.value);
                      setShowRefPhysicianDropdown(true);
                      setRefPhysicianDropdownIndex(0);
                    }}
                    onBlur={() => setTimeout(() => setShowRefPhysicianDropdown(false), 200)}
                    autoComplete="off"
                    onKeyDown={e => {
                      if (!showRefPhysicianDropdown) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setRefPhysicianDropdownIndex(i => Math.min(i + 1, filteredRefPhysicians.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setRefPhysicianDropdownIndex(i => Math.max(i - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredRefPhysicians[refPhysicianDropdownIndex]) {
                          setForm((f: any) => ({ ...f, refPhysician: filteredRefPhysicians[refPhysicianDropdownIndex].physicianID }));
                          setRefPhysicianSearch(filteredRefPhysicians[refPhysicianDropdownIndex].name);
                          setShowRefPhysicianDropdown(false);
                        }
                      } else if (e.key === 'Escape' || e.key === 'Tab') {
                        setShowRefPhysicianDropdown(false);
                      }
                    }}
                  />
                  {showRefPhysicianDropdown && (
                    <div className="absolute z-50 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded shadow max-h-60 overflow-y-auto w-full mt-1">
                      {filteredRefPhysicians.length === 0 && (
                        <div className="px-4 py-2 text-gray-500">No results</div>
                      )}
                      {filteredRefPhysicians.length > 0 && (
                        <div className="grid grid-cols-2 font-semibold text-xs px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                          <div>Name</div>
                          <div>Department</div>
                        </div>
                      )}
                      {filteredRefPhysicians.map((phy: any, idx: number) => (
                        <div
                          key={phy.physicianID}
                          className={`grid grid-cols-2 px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${refPhysicianDropdownIndex === idx ? 'selected-accent' : ''}`}
                          style={{ cursor: 'pointer', alignItems: 'center' }}
                          onMouseDown={() => {
                            setForm((f: any) => ({ ...f, refPhysician: phy.physicianID }));
                            setRefPhysicianSearch(phy.name);
                            setShowRefPhysicianDropdown(false);
                          }}
                          onMouseEnter={() => setRefPhysicianDropdownIndex(idx)}
                        >
                          <div>{phy.name}</div>
                          <div className="text-gray-500 text-xs">{phy.department}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div className="mt-6 space-y-4">
            <h4 className="font-medium text-gray-700 border-b pb-2">Additional Information</h4>
            
            <div className="form-group">
              <label className="form-label">Diagnosis</label>
              <input 
                name="diagnosis" 
                value={form?.diagnosis || ''} 
                onChange={handleChange} 
                className="form-input"
                placeholder="Enter diagnosis (optional)"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea 
                name="procedureNotesText" 
                value={form?.procedureNotesText || ''} 
                onChange={handleChange} 
                className="form-textarea"
                placeholder="Enter procedure notes (optional)"
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Follow up</label>
              {(viewOnly && !isEditing) ? (
                <div className="form-input bg-gray-50 min-h-[2.5rem] whitespace-pre-line" style={{padding:'0.5rem 0.75rem'}}>{form?.followUp || '-'}</div>
              ) : (
                <input
                  name="followUp"
                  value={form?.followUp || ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter follow up details (optional)"
                />
              )}
            </div>
            
            <div className="form-group">
              <label className="form-label">Cost</label>
              <input 
                name="procedureCost" 
                type="number" 
                value={form?.procedureCost || ''} 
                onChange={handleChange} 
                min="0" 
                step="0.01" 
                className="form-input"
                placeholder="0.00 (optional)"
              />
            </div>
          </div>
          
          {error && <div className="text-red-600 font-medium mb-2">{error}</div>}
          
          <div className="flex gap-3 mt-6">
            {(isEditing || !viewOnly) ? (
              <>
                <button type="submit" className="btn btn-primary flex-1">
                  Save
                </button>
                <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                {(!initialData || !initialData.procedureID) && (isEditing || !viewOnly) && (
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    onClick={() => {
                      setForm({ ...defaultForm, procedureDate: '', procedureTime: '', refPhysician: '' });
                      setRefPhysicianSearch('');
                    }}
                  >
                    Clear Form
                  </button>
                )}
              </>
            ) : null}
          </div>
        </form>

        {/* Metadata fields in viewOnly mode */}
        {(viewOnly && !isEditing) && initialData && (
          <div className="mt-8 border-t pt-4 text-xs text-gray-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {initialData.createdAt && (
                <div><span className="font-semibold">Created At:</span> {new Date(initialData.createdAt).toLocaleString()}</div>
              )}
              {initialData.updatedAt && (
                <div><span className="font-semibold">Updated At:</span> {new Date(initialData.updatedAt).toLocaleString()}</div>
              )}
              {initialData.createdByObj?.name && (
                <div><span className="font-semibold">Created By:</span> {initialData.createdByObj.name}</div>
              )}
              {initialData.updatedByObj?.name && (
                <div><span className="font-semibold">Updated By:</span> {initialData.updatedByObj.name}</div>
              )}
            </div>
          </div>
        )}

        {/* Custom Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-sm w-full">
              <h2 className="text-lg font-bold mb-2">IR Register</h2>
              {!confirmingDelete ? (
                <>
                  <p className="mb-4">Are you sure you want to delete this procedure log? This action cannot be undone.</p>
                  <div className="flex justify-end gap-3">
                    <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                    <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>Delete</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-4 font-semibold text-red-600">Are you <b>sure</b> you want to permanently delete this procedure log?</p>
                  <div className="flex justify-end gap-3">
                    <button className="btn btn-secondary" onClick={() => { setShowDeleteConfirm(false); setConfirmingDelete(false); }}>Cancel</button>
                    <button className="btn btn-danger" onClick={() => { onDelete && onDelete(idToDelete); setShowDeleteConfirm(false); setConfirmingDelete(false); }}>Yes, Delete Permanently</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 