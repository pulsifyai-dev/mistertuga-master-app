'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Clock,
  Package,
} from 'lucide-react';
import {
  generateSupplierExport,
  getExportableOrderCount,
  getExportHistory,
  getExportDownloadUrl,
  type SupplierExport,
} from '../export-actions';
import type { CountryCode } from '../types';

interface ExportPanelProps {
  activeCountry: CountryCode;
}

export function ExportPanel({ activeCountry }: ExportPanelProps) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [exportableCount, setExportableCount] = useState(0);
  const [history, setHistory] = useState<SupplierExport[]>([]);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const country = activeCountry === 'ALL' ? null : activeCountry;

  const fetchData = useCallback(async () => {
    if (!isAdmin || !country) {
      setLoadingHistory(false);
      return;
    }

    const [countResult, historyResult] = await Promise.all([
      getExportableOrderCount(country),
      getExportHistory(country),
    ]);

    if (countResult.success) setExportableCount(countResult.count);
    if (historyResult.success) setHistory(historyResult.exports);
    setLoadingHistory(false);
  }, [isAdmin, country]);

  useEffect(() => {
    setLoadingHistory(true);
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    if (!country) return;
    setGenerating(true);
    const result = await generateSupplierExport(country);
    if (result.success) {
      toast({
        title: `Export generated: ${result.totalOrders} orders, ${result.totalItems} items`,
        description: result.fileName,
      });
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
      fetchData();
    } else {
      toast({ title: 'Export Failed', description: result.error, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleDownload = async (exp: SupplierExport) => {
    if (!exp.file_url) return;
    setDownloading(exp.id);
    const result = await getExportDownloadUrl(exp.file_url);
    if (result.success && result.url) {
      window.open(result.url, '_blank');
    } else {
      toast({ title: 'Download Failed', description: result.error, variant: 'destructive' });
    }
    setDownloading(null);
  };

  if (!isAdmin || activeCountry === 'ALL') return null;

  return (
    <Card className="border-white/10 bg-black/30">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-purple-400" />
          Supplier Export
          {exportableCount > 0 && (
            <Badge className="bg-purple-600 text-white text-[10px] h-5">
              {exportableCount} ready
            </Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating || exportableCount === 0}
          className="bg-purple-600 text-white hover:bg-purple-500"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {generating ? 'Generating...' : exportableCount === 0 ? 'No New Orders' : `Export ${exportableCount} Orders`}
        </Button>
      </CardHeader>

      <CardContent>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            No previous exports for {country}.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Recent Exports</p>
            {history.slice(0, 5).map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium truncate">{exp.file_name}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(exp.exported_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {exp.total_items} items
                    </span>
                    {exp.total_cost != null && (
                      <span>${exp.total_cost.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 hover:bg-purple-500/20"
                  onClick={() => handleDownload(exp)}
                  disabled={downloading === exp.id}
                >
                  {downloading === exp.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
