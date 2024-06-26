import { GridOptions, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { format, intervalToDuration } from 'date-fns';
import { formatDuration } from './time.utils';

export const dateValueFormatter = (params: ValueFormatterParams): string => {
  return params.value ? format(params.value, 'yyyy-MM-dd HH:mm:ss') : '';
};

export const timeValueFormatter = (params: ValueFormatterParams): string => {
  return params.value ? format(params.value, 'HH:mm:ss') : '';
};

export const durationValueFormatter = (params: ValueFormatterParams) => {
  return formatDuration(params.value);
};

export const updatedAtValueFormatter = (params: ValueFormatterParams) => {
  if (!params.value) return '';
  const duration = intervalToDuration({ start: params.value, end: new Date() });
  if (duration?.days && duration.days > 30) return `>30d ago`;
  if (duration.days) return `${duration.days}d ago`;
  if (duration.hours) return `${duration.hours}h ago`;
  if (duration.minutes) return `${duration.minutes}m ago`;
  if (duration.seconds) return `${duration.seconds}s ago`;
  return `${Math.trunc(params.value * 1000)}ms ago`;
};

export const defaultGridOptions: GridOptions = {
  enableCellTextSelection: true,
  defaultColDef: {
    sortable: true,
    resizable: true,
  },
};

export const urlCellRenderer = (params: ICellRendererParams) => {
  return params.data.url
    ? `<a href="${params.data.url}" target="_blank" rel="noopener">${params.value}</a>`
    : params.value;
};

export const checkboxCellRenderer = (params: ICellRendererParams) => {
  return `<input type='checkbox' onclick="return false" ${params.value ? 'checked' : ''} />`;
};
