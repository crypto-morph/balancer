"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DbViewerData = {
  tables: string[];
  data: Record<string, unknown[]>;
  schemas: Record<string, string>;
  dbPath: string;
};

export default function DbViewerPage() {
  const [data, setData] = useState<DbViewerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

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
        setData(json);
        if (json.tables && json.tables.length > 0) {
          setSelectedTable(json.tables[0]);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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

  if (!data) {
    return null;
  }

  const currentTableData = selectedTable ? data.data[selectedTable] || [] : [];
  const columns = currentTableData.length > 0 
    ? Object.keys(currentTableData[0] as Record<string, unknown>)
    : [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Database Viewer (Dev Only)</h1>
          <div className="text-sm text-zinc-500 mt-1">Database: {data.dbPath}</div>
        </header>

        <Tabs defaultValue="data" className="w-full">
          <TabsList>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
          </TabsList>

          <TabsContent value="data">
            <Card className="p-6">
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Select Table:</label>
                <select
                  value={selectedTable || ""}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white dark:bg-zinc-900"
                >
                  {data.tables.map((table) => (
                    <option key={table} value={table}>
                      {table} ({data.data[table]?.length || 0} rows)
                    </option>
                  ))}
                </select>
              </div>

              {selectedTable && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((col) => (
                          <TableHead key={col} className="font-medium">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentTableData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="text-center text-zinc-500">
                            No data
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentTableData.map((row, idx) => (
                          <TableRow key={idx}>
                            {columns.map((col) => {
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
              )}
            </Card>
          </TabsContent>

          <TabsContent value="schema">
            <Card className="p-6">
              <div className="space-y-4">
                {data.tables.map((table) => (
                  <div key={table} className="border-b pb-4 last:border-b-0">
                    <h3 className="font-semibold mb-2">{table}</h3>
                    <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-3 rounded overflow-x-auto">
                      {data.schemas[table] || "No schema available"}
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

