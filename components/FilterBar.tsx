import React from 'react';

interface FilterBarProps {
  searchText: string;
  setSearchText: (v: string) => void;
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
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  modalityFilter: string;
  setModalityFilter: (v: string) => void;
  procedureNameFilter: string;
  setProcedureNameFilter: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  customDateRange: { from: string; to: string };
  setCustomDateRange: (v: { from: string; to: string }) => void;
  procedureNames: string[];
  modalities: string[];
  accentColor: string;
  clearStatusFilter: () => void;
  clearModalityFilter: () => void;
  clearProcedureNameFilter: () => void;
  clearDateFilter: () => void;
  clearAllFilters: () => void;
  dateFilters: { label: string; value: string }[];
}

const SEARCH_FIELDS = [
  { key: 'patientID', label: 'Patient ID' },
  { key: 'patientName', label: 'Name' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'procedureName', label: 'Procedure Name' },
  { key: 'notes', label: 'Notes' },
  { key: 'followUp', label: 'Followup' }
];

const MODALITY_OPTIONS = [
  { value: 'USG', label: 'USG' },
  { value: 'CT', label: 'CT' },
  { value: 'OT', label: 'OT' },
  { value: 'XF', label: 'XF' },
  { value: 'DSA', label: 'DSA' },
];

const FilterBar: React.FC<FilterBarProps> = ({
  searchText,
  setSearchText,
  searchFields,
  setSearchFields,
  referringPhysicians,
  refPhysicianFilter,
  setRefPhysicianFilter,
  irPhysicians,
  doneByFilter,
  setDoneByFilter,
  clearRefPhysicianFilter,
  clearDoneByFilter,
  statusFilter,
  setStatusFilter,
  modalityFilter,
  setModalityFilter,
  procedureNameFilter,
  setProcedureNameFilter,
  dateFilter,
  setDateFilter,
  customDateRange,
  setCustomDateRange,
  procedureNames,
  modalities,
  accentColor,
  clearStatusFilter,
  clearModalityFilter,
  clearProcedureNameFilter,
  clearDateFilter,
  clearAllFilters,
  dateFilters,
}) => {
  const allSelected = searchFields.length === SEARCH_FIELDS.length;
  const handleToggleSelect = () => {
    if (allSelected) setSearchFields([]);
    else setSearchFields(SEARCH_FIELDS.map(f => f.key));
  };

  React.useEffect(() => {
    if (!dateFilter) setDateFilter('currentMonth');
  }, [dateFilter, setDateFilter]);

  const handleClearAllFilters = () => {
    clearAllFilters();
    setDateFilter('currentMonth');
  };

  // Sort referringPhysicians alphabetically by name for the dropdown
  const sortedReferringPhysicians = [...referringPhysicians].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <>
      {/* FilterBar: Two rows, each horizontally scrollable if needed */}
      <div className="overflow-x-auto whitespace-nowrap w-full pb-2">
        <div className="inline-flex items-center gap-2 w-max mb-2">
          {/* Row 1: Status, Modality, Procedure, Date, Referring Physician, Done by IR */}
          <div className="flex flex-wrap gap-2 items-center mb-2 w-full">
            <div style={{ position: 'relative' }} className="flex items-center min-w-0 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="form-select w-full sm:w-auto"
                style={{ minWidth: 120 }}
              >
                <option value="">All Status</option>
                <option value="IP">Inpatient</option>
                <option value="OP">Outpatient</option>
              </select>
              {statusFilter && (
                <button
                  onClick={clearStatusFilter}
                  style={{ marginLeft: -24, background: 'none', border: 'none', cursor: 'pointer', color: accentColor }}
                  title="Clear Status"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="10" fill="#F87171"/>
                    <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }} className="flex items-center min-w-0 w-full sm:w-auto">
              <select
                value={modalityFilter}
                onChange={e => setModalityFilter(e.target.value)}
                className="form-select w-full sm:w-auto"
                style={{ minWidth: 120 }}
              >
                <option value="">All Modalities</option>
                {MODALITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {modalityFilter && (
                <button
                  onClick={clearModalityFilter}
                  style={{ marginLeft: -24, background: 'none', border: 'none', cursor: 'pointer', color: accentColor }}
                  title="Clear Modality"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="10" fill="#F87171"/>
                    <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
            <div style={{ position: 'relative', minWidth: 160 }} className="flex items-center min-w-0 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Procedure Name"
                value={procedureNameFilter}
                onChange={e => setProcedureNameFilter(e.target.value)}
                className="form-input px-3 py-2 rounded border w-full sm:w-auto"
                autoComplete="off"
              />
              {procedureNameFilter && (
                <button
                  onClick={clearProcedureNameFilter}
                  style={{ marginLeft: -24, background: 'none', border: 'none', cursor: 'pointer', color: accentColor }}
                  title="Clear Procedure Name"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="10" fill="#F87171"/>
                    <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }} className="flex items-center min-w-0 w-full sm:w-auto">
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="form-select w-full sm:w-auto"
                style={{ minWidth: 120 }}
              >
                {dateFilters.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {dateFilter !== 'currentMonth' && (
                <button
                  onClick={() => { setDateFilter('currentMonth'); setCustomDateRange({ from: '', to: '' }); }}
                  style={{ marginLeft: -24, background: 'none', border: 'none', cursor: 'pointer', color: accentColor }}
                  title="Clear Date"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="10" fill="#F87171"/>
                    <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
            {dateFilter === 'custom' && (
              <>
                <input
                  type="date"
                  value={customDateRange.from}
                  onChange={e => setCustomDateRange({ ...customDateRange, from: e.target.value })}
                  className="form-input px-2 py-1 rounded border w-full sm:w-auto"
                />
                <span>-</span>
                <input
                  type="date"
                  value={customDateRange.to}
                  onChange={e => setCustomDateRange({ ...customDateRange, to: e.target.value })}
                  className="form-input px-2 py-1 rounded border w-full sm:w-auto"
                />
              </>
            )}
            <div style={{ position: 'relative', minWidth: 140 }} className="flex items-center min-w-0 w-full sm:w-auto">
              <select
                value={refPhysicianFilter}
                onChange={e => setRefPhysicianFilter(e.target.value)}
                className="form-select w-full sm:w-auto"
                style={{ minWidth: 140 }}
              >
                <option value="">All Referring Physicians</option>
                {sortedReferringPhysicians.map(p => <option key={p.physicianID} value={p.physicianID}>{p.name}</option>)}
              </select>
              {refPhysicianFilter && (
                <button
                  onClick={clearRefPhysicianFilter}
                  style={{ marginLeft: -24, background: 'none', border: 'none', cursor: 'pointer', color: accentColor }}
                  title="Clear Referring Physician"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="10" fill="#F87171"/>
                    <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
            <div style={{ position: 'relative', minWidth: 140 }} className="flex items-center min-w-0 w-full sm:w-auto">
              <select
                value={doneByFilter}
                onChange={e => setDoneByFilter(e.target.value)}
                className="form-select w-full sm:w-auto"
                style={{ minWidth: 140 }}
              >
                <option value="">All IRs</option>
                {irPhysicians.map(p => <option key={p.physicianID} value={p.physicianID}>{p.name}</option>)}
              </select>
              {doneByFilter && (
                <button
                  onClick={clearDoneByFilter}
                  style={{ marginLeft: -24, background: 'none', border: 'none', cursor: 'pointer', color: accentColor }}
                  title="Clear Done By IR"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="10" fill="#F87171"/>
                    <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="inline-flex items-center gap-2 w-max">
            {/* Row 2: Master searchbox and checkboxes */}
            <div className="flex flex-row flex-wrap items-center gap-4 w-full">
              <div style={{ position: 'relative', minWidth: 180, marginTop: '6px' }} className="flex items-center">
                <input
                  type="text"
                  placeholder="Search by..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="form-input px-3 py-2 rounded border"
                  style={{ minWidth: 180, maxWidth: 200 }}
                />
                {searchText && (
                  <button
                    onClick={() => setSearchText('')}
                    style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: accentColor }}
                    title="Clear Search"
                    type="button"
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="10" cy="10" r="10" fill="#F87171"/>
                      <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex flex-row flex-wrap items-center gap-x-6">
                {SEARCH_FIELDS.map((f, idx) => (
                  <label key={f.key} className={`flex items-center text-sm`}>
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
                    <span className="ml-1">{f.label}&nbsp;&nbsp;&nbsp;</span>
                  </label>
                ))}
              </div>
              <span style={{ color: accentColor, cursor: 'pointer', fontWeight: 500, marginLeft: 24 }} onClick={handleToggleSelect}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </span>
              <span style={{ color: accentColor, cursor: 'pointer', fontWeight: 500, marginLeft: 16 }} onClick={handleClearAllFilters}>
                Clear All filters
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FilterBar; 