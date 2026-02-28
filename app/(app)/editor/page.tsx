"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Portfolio = {
  id: string;
  slug: string;
  theme: string;
  bio: string | null;
  socialsJson: Record<string, string>;
  isPublished: boolean;
};

export default function EditorPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    fetch("/api/portfolio/repos")
      .then((r) => r.json())
      .then((data) => {
        if (data.portfolio) {
          setPortfolio(data.portfolio);
          setBio(data.portfolio.bio ?? "");
          const s = data.portfolio.socialsJson ?? {};
          setEmail(s.email ?? "");
          setWebsite(s.website ?? "");
          setLinkedin(s.linkedin ?? "");
          setIsPublished(data.portfolio.isPublished ?? false);
        }
        setLoading(false);
      });
  }, []);

  async function save() {
    if (!portfolio) return;
    setSaving(true);
    try {
      await fetch("/api/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio,
          socialsJson: { email, website, linkedin },
          isPublished: isPublished,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!portfolio) return <div className="text-muted-foreground">Create a portfolio from the dashboard first.</div>;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Edit portfolio</h1>
        <p className="text-muted-foreground">
          Customize your public portfolio. It will be available at <strong>/u/{portfolio.slug}</strong> when published.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short bio about you..."
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input id="linkedin" type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="publish">Published</Label>
            <Switch id="publish" checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
