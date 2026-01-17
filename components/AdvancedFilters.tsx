import React from 'react';

const SEARCH_FIELDS = [
  { key: 'patientID', label: 'Patient ID' },
  { key: 'patientName', label: 'Name' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'procedureName', label: 'Procedure Name' },
  { key: 'notes', label: 'Notes' },
  { key: 'followUp', label: 'Followup' }
];

interface AdvancedFiltersProps {
  searchFields: string[];
  setSearchFields: (fields: string[] | ((fields: string[]) => string[])) => void;
  referringPhysicians: any[];
  refPhysicianFilter: string;
  setRefPhysicianFilter: (v: string) => void;
  irPhysicians: any[];
  doneByFilter: string;
  setDoneByFilter: (v: string) => void;
  clearRefPhysicianFilter: () => void;
  clearDoneByFilter: () => void;
  accentColor: string;
}

export default function AdvancedFilters({
  searchFields, setSearchFields,
  referringPhysicians, refPhysicianFilter, setRefPhysicianFilter,
  irPhysicians, doneByFilter, setDoneByFilter,
  clearRefPhysicianFilter, clearDoneByFilter,
  accentColor
}: AdvancedFiltersProps) {
  const handleSelectAll = () => setSearchFields(SEARCH_FIELDS.map(f => f.key));
  const handleDeselectAll = () => setSearchFields([]);
  const allSelected = searchFields.length === SEARCH_FIELDS.length;
  const handleToggleSelect = () => {
    if (allSelected) setSearchFields([]);
    else setSearchFields(SEARCH_FIELDS.map(f => f.key));
  };
  return (
    <div className="card mb-4">
      <div className="card-body flex flex-col gap-2">
        <div className="flex gap-3 items-center flex-wrap">
          {SEARCH_FIELDS.map(f => (
            <label key={f.key} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={searchFields.includes(f.key)}
                onChange={e => {
                  setSearchFields((fields: string[]) =>
                    e.target.checked
                      ? [...fields, f.key]
                      : fields.filter((k: string) => k !== f.key)
                  );
                }}
              />
              {f.label}
            </label>
          ))}
        </div>
        <div className="flex gap-4 mt-1 mb-2">
          <span style={{ color: accentColor, cursor: 'pointer', fontWeight: 500 }} onClick={handleToggleSelect}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <select value={refPhysicianFilter} onChange={e => setRefPhysicianFilter(e.target.value)} className="form-select" style={{ maxWidth: 220, minWidth: 140 }}>
            <option value="">All Referring Physicians</option>
            {referringPhysicians.map(p => <option key={p.physicianID} value={p.physicianID}>{p.name}</option>)}
          </select>
          {refPhysicianFilter && (
            <span onClick={clearRefPhysicianFilter} title="Clear" style={{ cursor: 'pointer', marginLeft: 2, display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="10" fill="#F87171"/>
                <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
          )}
          <select value={doneByFilter} onChange={e => setDoneByFilter(e.target.value)} className="form-select" style={{ maxWidth: 220, minWidth: 140 }}>
            <option value="">All IRs</option>
            {irPhysicians.map(p => <option key={p.physicianID} value={p.physicianID}>{p.name}</option>)}
          </select>
          {doneByFilter && (
            <span onClick={clearDoneByFilter} title="Clear" style={{ cursor: 'pointer', marginLeft: 2, display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="10" fill="#F87171"/>
                <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
} 