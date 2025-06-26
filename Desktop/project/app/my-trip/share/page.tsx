'use client';

import { useState, useEffect } from 'react';
import { useTrip } from '@/lib/contexts/trip-context';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Share2, Copy, Check, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { NoTripSelected } from '@/components/ui/no-trip-selected';

export default function SharePage() {
  const [shareLink, setShareLink] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { activeTrip, navigateWithTrip } = useTrip();
  const router = useRouter();

  useEffect(() => {
    if (!activeTrip) return;
    
    const fetchShareData = async () => {
      setIsLoading(true);
      const supabase = createClient();
      
      try {
        // Check if trip already has share data
        const { data, error } = await supabase
          .from('trip_groups')
          .select('share_code, share_link')
          .eq('id', activeTrip.id)
          .single();
          
        if (error) {
          console.error('Error fetching share data:', error);
        } else {
          let tripShareCode = data?.share_code;
          let tripShareLink = data?.share_link;
          
          // If no share code/link, generate them
          if (!tripShareCode || !tripShareLink) {
            tripShareCode = Math.floor(100000 + Math.random() * 900000).toString();
            tripShareLink = crypto.randomUUID();
            
            // Update trip with share data
            await supabase
              .from('trip_groups')
              .update({
                share_code: tripShareCode,
                share_link: tripShareLink
              })
              .eq('id', activeTrip.id);
          }
          
          setShareCode(tripShareCode);
          setShareLink(`${window.location.origin}/join/${tripShareLink}`);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchShareData();
  }, [activeTrip]);
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleBackToTrip = () => {
    navigateWithTrip('/my-trip');
  };
  
  const handleViewMembers = () => {
    if (activeTrip) {
      router.push(`/trip-members?id=${activeTrip.id}`);
    }
  };

  return (
    <div className="container pb-20 pt-4">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={handleBackToTrip}>
          ← Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Share Trip</h1>
          {activeTrip && (
            <p className="text-sm text-muted-foreground">Trip: {activeTrip.name}</p>
          )}
        </div>
      </div>
      
      {!activeTrip ? (
        <NoTripSelected 
          title="No trip selected to share" 
          message="Please select, create, or join a trip to share it with others"
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Share2 className="h-5 w-5 text-sky-500" />
                Share with Link
              </h2>
              
              <p className="text-sm text-muted-foreground mb-4">
                Share this link with friends to invite them to your trip
              </p>
              
              <div className="flex gap-2">
                <Input 
                  value={shareLink} 
                  readOnly 
                  className="flex-1 bg-gray-50 dark:bg-gray-800"
                />
                <Button 
                  onClick={handleCopyLink}
                  variant="outline"
                  className="flex gap-1 items-center"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-500" />
                Join Code
              </h2>
              
              <p className="text-sm text-muted-foreground mb-4">
                Or share this 6-digit code with your friends
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md text-center">
                <div className="text-3xl font-bold tracking-widest">{shareCode}</div>
                <p className="text-xs text-muted-foreground mt-1">Ask friends to enter this code on the join screen</p>
              </div>
            </CardContent>
          </Card>
          
          <Button 
            onClick={handleViewMembers}
            className="w-full bg-sky-500 hover:bg-sky-600 flex items-center gap-2 justify-center"
          >
            <Users className="h-4 w-4" />
            <span>View Trip Members</span>
          </Button>
        </div>
      )}
    </div>
  );
} 