"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TableInfo = {
  name: string;
  rowCount: number;
};

type TableData = {
  table: string;
  columns: string[];
  data: unknown[];
  count: number;
  limit: number;
  offset: number;
  tableInfo: Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
  }>;
};

type QueryResult = {
  query: string;
  result: unknown[];
  rowCount: number;
  error?: string;
};

type DbViewerData = {
  tables: TableInfo[];
  schemas: Record<string, string>;
  dbPath: string;
};

export default function DbViewerPage() {
  const [dbInfo, setDbInfo] = useState<DbViewerData | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM assets LIMIT 100");
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dev/db");
        if (!res.ok) {
          if (res.status === 403) {
            setError("Database viewer is only available in development mode");
          } else {
            setError(`Error: ${res.statusText}`);
          }
          return;
        }
        const json = await res.json();
        setDbInfo(json);
        if (json.tables && json.tables.length > 0) {
          setSelectedTable(json.tables[0].name);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable, limit, offset);
    }
  }, [selectedTable, limit, offset]);

  async function loadTableData(table: string, lim: number, off: number) {
    try {
      const res = await fetch(`/api/dev/db?table=${encodeURIComponent(table)}&limit=${lim}&offset=${off}`);
      if (res.ok) {
        const data = await res.json();
        setTableData(data);
      }
    } catch (err) {
      console.error("Failed to load table data:", err);
    }
  }

  async function executeQuery() {
    if (!sqlQuery.trim()) return;
    try {
      const res = await fetch(`/api/dev/db?query=${encodeURIComponent(sqlQuery)}`);
      const data = await res.json();
      if (data.error) {
        setQueryResult({ query: sqlQuery, result: [], rowCount: 0, error: data.error });
      } else {
        setQueryResult({ query: sqlQuery, result: data.result, rowCount: data.rowCount });
      }
    } catch (err) {
      setQueryResult({ query: sqlQuery, result: [], rowCount: 0, error: String(err) });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="p-6">
            <div className="text-sm text-zinc-500">Loading database...</div>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="p-6">
            <div className="text-sm text-red-600">{error}</div>
          </Card>
        </div>
      </div>
    );
  }

  if (!dbInfo) {
    return null;
  }

  const queryColumns = queryResult && queryResult.result.length > 0
    ? Object.keys(queryResult.result[0] as Record<string, unknown>)
    : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Database Viewer (Dev Only)</h1>
          <div className="text-sm text-zinc-500 mt-1">Database: {dbInfo.dbPath}</div>
        </header>

        <Tabs defaultValue="tables" className="w-full">
          <TabsList>
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="query">SQL Query</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
          </TabsList>

          <TabsContent value="tables">
            <Card className="p-6">
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Select Table:</label>
                <select
                  value={selectedTable || ""}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setOffset(0);
                  }}
                  className="px-3 py-2 border rounded-md bg-white dark:bg-zinc-900 w-full max-w-md"
                >
                  {dbInfo.tables.map((table) => (
                    <option key={table.name} value={table.name}>
                      {table.name} ({table.rowCount.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </div>

              {tableData && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-zinc-600">
                    <span>Total rows: {tableData.count.toLocaleString()}</span>
                    <span>Showing: {tableData.offset + 1} - {Math.min(tableData.offset + tableData.limit, tableData.count)}</span>
                  </div>

                  {tableData.tableInfo.length > 0 && (
                    <div className="border rounded p-3 bg-zinc-50 dark:bg-zinc-900">
                      <div className="text-xs font-medium mb-2">Table Structure:</div>
                      <div className="grid grid-cols-6 gap-2 text-xs">
                        <div className="font-medium">Column</div>
                        <div className="font-medium">Type</div>
                        <div className="font-medium">Nullable</div>
                        <div className="font-medium">Default</div>
                        <div className="font-medium">PK</div>
                        <div className="font-medium">Index</div>
                        {tableData.tableInfo.map((col) => (
                          <>
                            <div key={`${col.name}-name`}>{col.name}</div>
                            <div key={`${col.name}-type`}>{col.type}</div>
                            <div key={`${col.name}-null`}>{col.notnull ? "NO" : "YES"}</div>
                            <div key={`${col.name}-default`}>{col.dflt_value ? String(col.dflt_value) : "-"}</div>
                            <div key={`${col.name}-pk`}>{col.pk ? "✓" : "-"}</div>
                            <div key={`${col.name}-idx`}>-</div>
                          </>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-zinc-600">
                      Page {Math.floor(offset / limit) + 1} of {Math.ceil(tableData.count / limit)}
                    </span>
                    <Button
                      onClick={() => setOffset(offset + limit)}
                      disabled={offset + limit >= tableData.count}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                    <Input
                      type="number"
                      value={limit}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 100;
                        setLimit(Math.max(1, Math.min(1000, val)));
                        setOffset(0);
                      }}
                      className="w-24"
                      min="1"
                      max="1000"
                    />
                    <span className="text-sm text-zinc-600">rows per page</span>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {tableData.columns.map((col) => (
                            <TableHead key={col} className="font-medium">
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableData.data.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={tableData.columns.length} className="text-center text-zinc-500">
                              No data
                            </TableCell>
                          </TableRow>
                        ) : (
                          tableData.data.map((row, idx) => (
                            <TableRow key={idx}>
                              {tableData.columns.map((col) => {
                                const value = (row as Record<string, unknown>)[col];
                                return (
                                  <TableCell key={col} className="font-mono text-xs">
                                    {value === null || value === undefined
                                      ? <span className="text-zinc-400">NULL</span>
                                      : String(value)}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="query">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">SQL Query:</label>
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    className="w-full h-32 font-mono text-sm p-3 border rounded-md bg-white dark:bg-zinc-900"
                    placeholder="SELECT * FROM assets LIMIT 100"
                  />
                </div>
                <Button onClick={executeQuery}>Execute Query</Button>

                {queryResult && (
                  <div className="space-y-4">
                    {queryResult.error ? (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600">
                        Error: {queryResult.error}
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-zinc-600">
                          Query returned {queryResult.rowCount.toLocaleString()} row(s)
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {queryColumns.map((col) => (
                                  <TableHead key={col} className="font-medium">
                                    {col}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {queryResult.result.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={queryColumns.length} className="text-center text-zinc-500">
                                    No results
                                  </TableCell>
                                </TableRow>
                              ) : (
                                queryResult.result.map((row, idx) => (
                                  <TableRow key={idx}>
                                    {queryColumns.map((col) => {
                                      const value = (row as Record<string, unknown>)[col];
                                      return (
                                        <TableCell key={col} className="font-mono text-xs">
                                          {value === null || value === undefined
                                            ? <span className="text-zinc-400">NULL</span>
                                            : String(value)}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="schema">
            <Card className="p-6">
              <div className="space-y-4">
                {dbInfo.tables.map((table) => (
                  <div key={table.name} className="border-b pb-4 last:border-b-0">
                    <h3 className="font-semibold mb-2">{table.name}</h3>
                    <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-3 rounded overflow-x-auto">
                      {dbInfo.schemas[table.name] || "No schema available"}
                    </pre>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
