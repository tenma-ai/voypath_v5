"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { updateTrip } from "@/lib/actions/trip-actions";
import PlaceSearch from "@/components/places/place-search";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGuestStore } from "@/lib/stores/guest-store";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Trip name must be at least 2 characters.",
  }),
  description: z.string().optional(),
  departureLocation: z.string().min(2, {
    message: "Departure location is required.",
  }),
  departureLocationCoords: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

interface EditTripFormProps {
  tripId: string;
}

export function EditTripForm({ tripId }: EditTripFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const { sessionId } = useGuestStore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      departureLocation: "",
      departureLocationCoords: undefined,
      startDate: undefined,
      endDate: undefined,
    },
  });

  // トリップデータの取得
  useEffect(() => {
    const fetchTripData = async () => {
      if (!tripId) return;
      
      setIsLoading(true);
      const supabase = createClient();
      
      try {
        const { data, error } = await supabase
          .from('trip_groups')
          .select('*')
          .eq('id', tripId)
          .single();
          
        if (error) {
          throw error;
        }
        
        // フォームに値をセット
        form.setValue('name', data.name);
        form.setValue('description', data.description || '');
        form.setValue('departureLocation', data.departure_location);
        
        if (data.departure_location_lat && data.departure_location_lng) {
          form.setValue('departureLocationCoords', {
            lat: data.departure_location_lat,
            lng: data.departure_location_lng,
          });
        }
        
        if (data.start_date) {
          form.setValue('startDate', new Date(data.start_date));
        }
        
        if (data.end_date) {
          form.setValue('endDate', new Date(data.end_date));
        }
      } catch (error) {
        console.error('Failed to fetch trip data:', error);
        toast({
          title: "Error",
          description: "Failed to load trip data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTripData();
  }, [tripId, form, toast]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);

    try {
      await updateTrip({
        id: tripId,
        name: values.name,
        description: values.description || "",
        departureLocation: values.departureLocation,
        startDate: values.startDate,
        endDate: values.endDate,
        sessionId: sessionId || '',
      });

      toast({
        title: "Success",
        description: "Trip has been updated successfully.",
      });
      
      router.push(`/my-trip?id=${tripId}`);
    } catch (error) {
      console.error("Failed to update trip:", error);
      toast({
        title: "Error",
        description: "Failed to update trip. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // 場所が選択されたときの処理
  const handlePlaceSelect = (place: {
    id: string;
    name: string;
    address: string;
    location: { lat: number; lng: number };
  }) => {
    form.setValue("departureLocation", place.address || place.name);
    form.setValue("departureLocationCoords", place.location);
    form.trigger("departureLocation");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trip Name</FormLabel>
              <FormControl>
                <Input placeholder="Summer Vacation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about your trip..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="departureLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Departure Location</FormLabel>
              <FormControl>
                <PlaceSearch
                  placeholder="Enter your departure location..."
                  defaultValue={field.value}
                  onPlaceSelect={handlePlaceSelect}
                />
              </FormControl>
              <FormDescription>
                Where will you start your journey?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date (Optional)</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>End Date (Optional)</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="flex-1"
          >
            Cancel
          </Button>
          
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-sky-500 hover:bg-sky-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Trip"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
} 