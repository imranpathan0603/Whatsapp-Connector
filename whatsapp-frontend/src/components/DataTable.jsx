import React from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import Loading from "./Loading.jsx";

export function DataTable({
  columns,
  data = [],
  loading = false,
  total = 0,
  limit = 50,
  offset = 0,
  onPageChange,
  onRowClick,
  emptyMessage = "No records to display",
  emptyDescription = "There are no records matching your current filter.",
}) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  if (loading && !data.length) {
    return <Loading message="Loading data..." />;
  }

  if (!loading && (!data || data.length === 0)) {
    return (
      <div className="table-empty-box">
        <Inbox size={36} className="table-empty-icon" />
        <h4>{emptyMessage}</h4>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrapper">
      <div className="table-scroll-container">
        <table className="modern-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key || col.label}
                  style={col.width ? { width: col.width } : undefined}
                  className={col.className || ""}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={row.id || row._id || index}
                onClick={() => onRowClick && onRowClick(row)}
                className={onRowClick ? "clickable-row" : ""}
              >
                {columns.map((col) => (
                  <td key={col.key || col.label} className={col.className || ""}>
                    {col.render ? col.render(row, index) : row[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && onPageChange && (
        <div className="table-pagination-footer">
          <div className="pagination-info">
            Showing <strong>{Math.min(offset + 1, total)}</strong> -{" "}
            <strong>{Math.min(offset + data.length, total)}</strong> of{" "}
            <strong>{total.toLocaleString()}</strong> records
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={!hasPrev || loading}
              onClick={() => onPageChange(Math.max(0, offset - limit))}
              title="Previous page"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="pagination-page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              disabled={!hasNext || loading}
              onClick={() => onPageChange(offset + limit)}
              title="Next page"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
