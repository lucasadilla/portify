"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account");
      window.location.replace("/api/auth/signout?callbackUrl=" + encodeURIComponent("/"));
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account.</p>
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger zone
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1.5">
            Permanently delete your account and all portfolio data. This cannot be undone.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {confirmDelete ? (
            <>
              <p className="text-sm text-muted-foreground">
                Are you sure? Your portfolio, projects, and all generated content will be removed.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, delete my account"}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
              Delete account
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
