import React, { createContext, Dispatch, SetStateAction } from 'react';

export const defaultColumns = [
  { key: 'patientID', label: 'Patient ID', visible: true },
  { key: 'patientName', label: 'Patient Name', visible: true },
  { key: 'patientAgeSex', label: 'Age/Sex', visible: true },
  { key: 'patientStatus', label: 'Status', visible: true },
  { key: 'modality', label: 'Modality', visible: true },
  { key: 'procedureName', label: 'Procedure Name', visible: true },
  { key: 'procedureDate', label: 'Date', visible: true },
  { key: 'procedureTime', label: 'Time', visible: true },
  { key: 'doneBy', label: 'Done By', visible: true },
  { key: 'refPhysician', label: 'Referring Physician', visible: true },
  { key: 'diagnosis', label: 'Diagnosis', visible: true },
  { key: 'procedureNotes', label: 'Procedure Notes', visible: true },
  { key: 'followUp', label: 'Follow-up', visible: true },
  { key: 'notes', label: 'Notes', visible: true },
  { key: 'procedureCost', label: 'Cost', visible: true },
];

export const ColumnContext = createContext<{
  columns: any[];
  setColumns: Dispatch<SetStateAction<any[]>>;
}>({ columns: defaultColumns, setColumns: () => {} }); 