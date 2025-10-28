"use client";

import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed, Plus, Trash2, RotateCcw, ChefHat, Sparkles, Loader2, CalendarClock, History, Lock, Key } from "lucide-react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


type Restaurant = {
  id: string;
  name: string;
  blacklisted: boolean;
  lastSelectedDate?: number;
};

const formSchema = z.object({
  restaurantName: z.string().min(1, "Please enter a restaurant name.").max(50, "Name is too long."),
});

const WEEKS_TO_MS = (weeks: number) => weeks * 7 * 24 * 60 * 60 * 1000;
const SECRET_CODE = "LizRulz!";

export default function LunchRouletteClient() {
  // Server-backed shared state
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [cooldownWeeks, setCooldownWeeks] = useState<number>(2);
  const [activatedBy, setActivatedBy] = useState<string | undefined>(undefined);
  const [isActivated, setIsActivated] = useLocalStorage<boolean>("isActivated", false);
  const [activationAttempt, setActivationAttempt] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isStateLoading, setIsStateLoading] = useState(true);
  const [stateError, setStateError] = useState<string | null>(null);
  const { toast } = useToast();

  // Generate a persistent session ID stored in localStorage
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    setIsClient(true);
    
    // Initialize persistent session ID on client side
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("lunchRouletteSessionId");
      if (stored) {
        setSessionId(stored);
      } else {
        const newId = crypto.randomUUID();
        localStorage.setItem("lunchRouletteSessionId", newId);
        setSessionId(newId);
      }
    }
  }, []);

  // Load shared state from server
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsStateLoading(true);
      setStateError(null);
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load state (${res.status})`);
        const data = await res.json();
        if (!cancelled) {
          setRestaurants(Array.isArray(data?.restaurants) ? data.restaurants : []);
          setCooldownWeeks(typeof data?.cooldownWeeks === "number" ? data.cooldownWeeks : 2);
          setActivatedBy(data?.activatedBy);
          
          // If this session is the activator, ensure local activation is also set
          if (data?.activatedBy === sessionId && !isActivated) {
            setIsActivated(true);
          }
        }
      } catch (e: any) {
        if (!cancelled) setStateError(e?.message ?? "Failed to load state");
      } finally {
        if (!cancelled) setIsStateLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, isActivated]);

  async function persist(nextRestaurants: Restaurant[] = restaurants, nextCooldownWeeks: number = cooldownWeeks, nextActivatedBy?: string) {
    try {
      const res = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurants: nextRestaurants,
          cooldownWeeks: nextCooldownWeeks,
          activatedBy: nextActivatedBy !== undefined ? nextActivatedBy : activatedBy
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Server error:", errorData);
        throw new Error(errorData.error || errorData.message || `Server error: ${res.status}`);
      }
    } catch (error: any) {
      console.error("Persist error:", error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: `Could not save changes: ${error.message || "Network error"}`
      });
    }
  }

  // Check if current user is the activator
  const isCurrentUserActivator = activatedBy === sessionId;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      restaurantName: "",
    },
  });

  const cooldownPeriodInMs = useMemo(() => WEEKS_TO_MS(cooldownWeeks), [cooldownWeeks]);

  const availableRestaurants = useMemo(() => {
    const now = Date.now();
    return restaurants.filter(r => 
        !r.blacklisted &&
        (!r.lastSelectedDate || (now - r.lastSelectedDate > cooldownPeriodInMs))
    );
  }, [restaurants, cooldownPeriodInMs]);

  const hasBlacklisted = useMemo(() => restaurants.some(r => r.blacklisted), [restaurants]);

  function handleAddRestaurant(values: z.infer<typeof formSchema>) {
    const newRestaurant: Restaurant = {
      id: crypto.randomUUID(),
      name: values.restaurantName.trim(),
      blacklisted: false,
    };
    const next = [...restaurants, newRestaurant];
    setRestaurants(next);
    persist(next);
    form.reset();
  }

  function handleRemoveRestaurant(id: string) {
    const next = restaurants.filter((r) => r.id !== id);
    setRestaurants(next);
    persist(next);
  }

  function handleToggleBlacklist(id: string) {
    const next = restaurants.map((r) =>
      r.id === id ? { ...r, blacklisted: !r.blacklisted } : r
    );
    setRestaurants(next);
    persist(next);
  }

  function handleResetBlacklist() {
    const next = restaurants.map((r) => ({ ...r, blacklisted: false }));
    setRestaurants(next);
    persist(next);
  }

  function handleResetCooldown(id: string) {
    const next = restaurants.map((r) =>
      r.id === id ? { ...r, lastSelectedDate: undefined } : r
    );
    setRestaurants(next);
    persist(next);
  }

  function handleResetAllRestaurants() {
    const next = restaurants.map((r) => ({
      ...r,
      blacklisted: false,
      lastSelectedDate: undefined
    }));
    setRestaurants(next);
    persist(next);
    toast({
      title: "Restaurants Reset!",
      description: "All restaurants have been unblacklisted and cooldowns cleared.",
    });
  }

  function handleDeleteAllRestaurants() {
    setRestaurants([]);
    persist([]);
    toast({
      title: "All Restaurants Deleted!",
      description: "The restaurant list has been cleared.",
    });
  }

  function handleActivation() {
      if (activationAttempt === SECRET_CODE) {
          setIsActivated(true);
          // Set this user as the activator
          persist(undefined, undefined, sessionId);
          toast({
              title: "Activated!",
              description: "You can now get lunch suggestions and manage restaurants.",
          });
      } else {
          toast({
              variant: "destructive",
              title: "Incorrect Code",
              description: "The secret code is not correct. Please try again.",
          });
      }
  }

  function handleGetSuggestion() {
    if (!isActivated) {
        toast({
            variant: "destructive",
            title: "Not Activated",
            description: "Please enter the secret code to activate the roulette.",
        });
        return;
    }
    
    if (availableRestaurants.length < 2) {
      toast({
        variant: "destructive",
        title: "Not enough options!",
        description: "Please add at least two active, available restaurants to get a suggestion.",
      });
      return;
    }

    setDialogOpen(true);
    setIsLoading(true);
    setSuggestion(null);

    // Use a timeout to create a sense of anticipation
    setTimeout(() => {
        const randomIndex = Math.floor(Math.random() * availableRestaurants.length);
        const randomRestaurant = availableRestaurants[randomIndex];
        
        setSuggestion(randomRestaurant.name);
        const next = restaurants.map(r => 
          r.id === randomRestaurant.id 
          ? { ...r, lastSelectedDate: Date.now() } 
          : r
        );
        setRestaurants(next);
        persist(next);

        setIsLoading(false);
    }, 1500);
  }

  const isRestaurantOnCooldown = (restaurant: Restaurant) => {
    if (!restaurant.lastSelectedDate) return false;
    const now = Date.now();
    return (now - restaurant.lastSelectedDate) < cooldownPeriodInMs;
  };
  
  if (!isClient) {
    return null;
  }

  return (
    <TooltipProvider>
        <div className="w-full space-y-8">
        <header className="text-center">
            <UtensilsCrossed className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-4xl md:text-5xl font-bold font-headline">Lunch Roulette</h1>
            <p className="mt-2 text-lg text-muted-foreground">Can't decide? Let fate pick your lunch.</p>
        </header>

        <Card>
            <CardHeader>
                <CardTitle>Add a Restaurant</CardTitle>
                <CardDescription>
                    Build your list of potential lunch spots available on{" "}
                    <a
                        href="https://www.doordash.com/home"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline underline-offset-4"
                    >
                        DoorDash
                    </a>
                </CardDescription>
            </CardHeader>
            <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddRestaurant)} className="flex items-start gap-4">
                <FormField
                    control={form.control}
                    name="restaurantName"
                    render={({ field }) => (
                    <FormItem className="flex-grow">
                        <FormControl>
                        <Input placeholder="e.g., The Cozy Diner" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" aria-label="Add restaurant" disabled={isStateLoading}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                </Button>
                </form>
            </Form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                <CardTitle>Your Restaurants</CardTitle>
                <CardDescription>
                  {isCurrentUserActivator 
                    ? "Manage your list here. Toggle to temporarily exclude a spot."
                    : "View the shared restaurant list. Only the activator can make changes."
                  }
                </CardDescription>
                </div>
                {hasBlacklisted && isCurrentUserActivator && (
                <Button variant="ghost" size="sm" onClick={handleResetBlacklist} disabled={isStateLoading}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                </Button>
                )}
            </div>
            </CardHeader>
            <CardContent>
            <div className="space-y-4">
                {stateError ? (
                <div className="text-sm text-destructive">{stateError}</div>
                ) : isStateLoading ? (
                <div className="text-sm text-muted-foreground">Loading shared state…</div>
                ) : restaurants.length > 0 ? (
                <ul className="space-y-3">
                    <AnimatePresence>
                    {restaurants.map((restaurant) => {
                        const onCooldown = isRestaurantOnCooldown(restaurant);
                        return (
                        <motion.li
                            key={restaurant.id}
                            layout
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${restaurant.blacklisted || onCooldown ? 'bg-muted/50' : 'bg-background'}`}
                        >
                            <Switch
                            id={`blacklist-${restaurant.id}`}
                            checked={restaurant.blacklisted}
                            onCheckedChange={() => handleToggleBlacklist(restaurant.id)}
                            aria-label={`Exclude ${restaurant.name}`}
                            disabled={onCooldown || isStateLoading || !isCurrentUserActivator}
                            />
                            <div className="flex-grow">
                                <Label htmlFor={`blacklist-${restaurant.id}`} className={`text-lg transition-all ${restaurant.blacklisted || onCooldown ? 'line-through text-muted-foreground' : ''}`}>
                                    {restaurant.name}
                                </Label>
                                {onCooldown && isActivated && (
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground">
                                            On cooldown until {new Date(restaurant.lastSelectedDate! + cooldownPeriodInMs).toLocaleDateString()}
                                        </p>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleResetCooldown(restaurant.id)} disabled={isStateLoading || !isCurrentUserActivator}>
                                                    <History className="h-3 w-3" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Reset Cooldown</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                )}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRestaurant(restaurant.id)} aria-label={`Remove ${restaurant.name}`} disabled={isStateLoading || !isCurrentUserActivator}>
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                        </motion.li>
                        )
                    })}
                    </AnimatePresence>
                </ul>
                ) : (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <p>Your restaurant list is empty.</p>
                    <p className="text-sm">Add some spots to get started!</p>
                </div>
                )}
            </div>
            </CardContent>
            {restaurants.length > 0 && 
                <CardFooter className="flex-col items-stretch gap-4 pt-4">
                    <Separator/>
                     {isActivated ? (
                        <>
                            <Button size="lg" onClick={handleGetSuggestion} disabled={availableRestaurants.length < 2 || isStateLoading}>
                                <Sparkles className="mr-2 h-5 w-5" />
                                What's for Lunch?
                            </Button>
                            {availableRestaurants.length < 2 && (
                                <p className="text-sm text-center text-muted-foreground">Add at least two active, available restaurants to play.</p>
                            )}
                        </>
                     ) : (
                        <div className="text-center text-muted-foreground p-4 border border-dashed rounded-lg space-y-2">
                           <Lock className="mx-auto h-6 w-6" />
                           <p>The roulette is locked. Enter the secret code to activate.</p>
                        </div>
                     )}
                </CardFooter>
            }
        </Card>

        <AnimatePresence>
        {!isActivated && (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            Activation
                        </CardTitle>
                        <CardDescription>Enter the secret code to use the lunch roulette.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-start gap-4">
                            <div className="flex-grow">
                                <Input
                                    type="password"
                                    placeholder="Secret code"
                                    value={activationAttempt}
                                    onChange={(e) => setActivationAttempt(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleActivation()}
                                />
                            </div>
                            <Button onClick={handleActivation}>
                                Activate
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        )}
        </AnimatePresence>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5"/>
                    Options
                </CardTitle>
                <CardDescription>Customize the behavior of the roulette.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <Label htmlFor="cooldown-select">Cooldown Period</Label>
                     <Select
                         value={String(cooldownWeeks)}
                         onValueChange={(value) => { const v = Number(value); setCooldownWeeks(v); persist(undefined, v); }}
                         disabled={!isCurrentUserActivator}
                     >
                        <SelectTrigger className="w-[180px]" id="cooldown-select">
                            <SelectValue placeholder="Select cooldown" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1 Week</SelectItem>
                            <SelectItem value="2">2 Weeks</SelectItem>
                            <SelectItem value="3">3 Weeks</SelectItem>
                            <SelectItem value="4">4 Weeks</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  A chosen restaurant will be unavailable for this long.
                  {!isCurrentUserActivator && " (Only the activator can change this setting)"}
                </p>
            </CardContent>
        </Card>

        {isCurrentUserActivator && isActivated && restaurants.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5"/>
                        Admin Controls
                    </CardTitle>
                    <CardDescription>Power user controls for managing the restaurant list.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label>Reset All Restaurants</Label>
                                <p className="text-sm text-muted-foreground">Unblacklist all restaurants and clear cooldowns</p>
                            </div>
                            <Button 
                                variant="outline" 
                                onClick={handleResetAllRestaurants} 
                                disabled={isStateLoading}
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset All
                            </Button>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-destructive">Delete All Restaurants</Label>
                                <p className="text-sm text-muted-foreground">Permanently remove all restaurants from the list</p>
                            </div>
                            <Button 
                                variant="destructive" 
                                onClick={handleDeleteAllRestaurants} 
                                disabled={isStateLoading}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete All
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle className="font-headline text-2xl text-center">The Verdict Is In...</DialogTitle>
            </DialogHeader>
            <div className="min-h-[120px] flex items-center justify-center text-center">
                {isLoading ? (
                <div className="space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Spinning the wheel of fate...</p>
                </div>
                ) : (
                suggestion && (
                    <div className="space-y-4 animate-in fade-in-50">
                        <DialogDescription>Your delicious destiny is:</DialogDescription>
                        <p className="text-3xl font-bold font-headline text-accent flex items-center justify-center gap-2">
                            <ChefHat className="h-8 w-8" />
                            {suggestion}
                        </p>
                    </div>
                )
                )}
            </div>
            </DialogContent>
        </Dialog>
        </div>
    </TooltipProvider>
  );
}
