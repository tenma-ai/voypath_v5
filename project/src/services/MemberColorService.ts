/**
 * Member Color Service - Refined Color System for Trip Members
 * Manages automatic color assignment and persistence for trip members
 */

import { supabase } from '../lib/supabase';

export interface RefinedColor {
  id: number;
  name: string;
  hex: string;
  rgb: string;
  hsl: string;
}

export interface MemberColorAssignment {
  tripId: string;
  userId: string;
  colorIndex: number;
  color: RefinedColor;
  assignedAt: Date;
}

export class MemberColorService {
  private static readonly COLORS: RefinedColor[] = [
    { id: 1, name: 'Ocean Blue', hex: '#0077BE', rgb: 'rgb(0,119,190)', hsl: 'hsl(202,100%,37%)' },
    { id: 2, name: 'Forest Green', hex: '#228B22', rgb: 'rgb(34,139,34)', hsl: 'hsl(120,61%,34%)' },
    { id: 3, name: 'Sunset Orange', hex: '#FF6B35', rgb: 'rgb(255,107,53)', hsl: 'hsl(16,100%,60%)' },
    { id: 4, name: 'Royal Purple', hex: '#7B68EE', rgb: 'rgb(123,104,238)', hsl: 'hsl(249,80%,67%)' },
    { id: 5, name: 'Cherry Red', hex: '#DC143C', rgb: 'rgb(220,20,60)', hsl: 'hsl(348,83%,47%)' },
    { id: 6, name: 'Teal', hex: '#008080', rgb: 'rgb(0,128,128)', hsl: 'hsl(180,100%,25%)' },
    { id: 7, name: 'Amber', hex: '#FFC000', rgb: 'rgb(255,192,0)', hsl: 'hsl(45,100%,50%)' },
    { id: 8, name: 'Lavender', hex: '#E6E6FA', rgb: 'rgb(230,230,250)', hsl: 'hsl(240,67%,94%)' },
    { id: 9, name: 'Coral', hex: '#FF7F50', rgb: 'rgb(255,127,80)', hsl: 'hsl(16,100%,66%)' },
    { id: 10, name: 'Emerald', hex: '#50C878', rgb: 'rgb(80,200,120)', hsl: 'hsl(140,54%,55%)' },
    { id: 11, name: 'Magenta', hex: '#FF00FF', rgb: 'rgb(255,0,255)', hsl: 'hsl(300,100%,50%)' },
    { id: 12, name: 'Navy', hex: '#000080', rgb: 'rgb(0,0,128)', hsl: 'hsl(240,100%,25%)' },
    { id: 13, name: 'Rose', hex: '#FF007F', rgb: 'rgb(255,0,127)', hsl: 'hsl(330,100%,50%)' },
    { id: 14, name: 'Lime', hex: '#32CD32', rgb: 'rgb(50,205,50)', hsl: 'hsl(120,61%,50%)' },
    { id: 15, name: 'Indigo', hex: '#4B0082', rgb: 'rgb(75,0,130)', hsl: 'hsl(275,100%,25%)' },
    { id: 16, name: 'Turquoise', hex: '#40E0D0', rgb: 'rgb(64,224,208)', hsl: 'hsl(174,72%,56%)' },
    { id: 17, name: 'Crimson', hex: '#B22222', rgb: 'rgb(178,34,34)', hsl: 'hsl(0,68%,42%)' },
    { id: 18, name: 'Olive', hex: '#808000', rgb: 'rgb(128,128,0)', hsl: 'hsl(60,100%,25%)' },
    { id: 19, name: 'Slate', hex: '#708090', rgb: 'rgb(112,128,144)', hsl: 'hsl(210,13%,50%)' },
    { id: 20, name: 'Maroon', hex: '#800000', rgb: 'rgb(128,0,0)', hsl: 'hsl(0,100%,25%)' }
  ];


  /**
   * Assign a color to a trip member
   * Ensures color uniqueness within each trip (max 20 members)
   */
  static async assignColorToMember(tripId: string, userId: string): Promise<RefinedColor> {
    try {
      // Check if user already has a color assigned in this trip
      const { data: existingAssignment } = await supabase
        .from('trip_members')
        .select('assigned_color_index')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .single();

      if (existingAssignment?.assigned_color_index) {
        return this.COLORS[existingAssignment.assigned_color_index - 1];
      }

      // Get all assigned colors in this trip
      const { data: assignedColors } = await supabase
        .from('trip_members')
        .select('assigned_color_index')
        .eq('trip_id', tripId)
        .not('assigned_color_index', 'is', null);

      const usedIndices = new Set(assignedColors?.map(m => m.assigned_color_index) || []);

      // Find first available color
      let availableIndex = 1;
      while (usedIndices.has(availableIndex) && availableIndex <= 20) {
        availableIndex++;
      }

      if (availableIndex > 20) {
        throw new Error('No available colors (maximum 20 members per trip)');
      }

      // Assign the color
      const { error } = await supabase
        .from('trip_members')
        .update({
          assigned_color_index: availableIndex,
          color_assigned_at: new Date().toISOString()
        })
        .eq('trip_id', tripId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      return this.COLORS[availableIndex - 1];
    } catch (error) {
      console.error('Error assigning color to member:', error);
      throw error;
    }
  }

  /**
   * Get the assigned color for a trip member
   */
  static async getMemberColor(tripId: string, userId: string): Promise<RefinedColor | null> {
    try {
      const { data: member } = await supabase
        .from('trip_members')
        .select('assigned_color_index')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .single();

      if (!member?.assigned_color_index) {
        return null;
      }

      return this.COLORS[member.assigned_color_index - 1];
    } catch (error) {
      console.error('Error getting member color:', error);
      return null;
    }
  }

  /**
   * Get all available colors for a trip (not yet assigned)
   */
  static async getAvailableColors(tripId: string): Promise<RefinedColor[]> {
    try {
      const { data: assignedColors } = await supabase
        .from('trip_members')
        .select('assigned_color_index')
        .eq('trip_id', tripId)
        .not('assigned_color_index', 'is', null);

      const usedIndices = new Set(assignedColors?.map(m => m.assigned_color_index) || []);

      return this.COLORS.filter(color => !usedIndices.has(color.id));
    } catch (error) {
      console.error('Error getting available colors:', error);
      return [];
    }
  }

  /**
   * Get all member color assignments for a trip
   */
  static async getTripMemberColors(tripId: string): Promise<MemberColorAssignment[]> {
    try {
      const { data: members } = await supabase
        .from('trip_members')
        .select('user_id, assigned_color_index, color_assigned_at')
        .eq('trip_id', tripId)
        .not('assigned_color_index', 'is', null);

      if (!members) return [];

      return members.map(member => ({
        tripId,
        userId: member.user_id,
        colorIndex: member.assigned_color_index,
        color: this.COLORS[member.assigned_color_index - 1],
        assignedAt: new Date(member.color_assigned_at)
      }));
    } catch (error) {
      console.error('Error getting trip member colors:', error);
      return [];
    }
  }

  /**
   * Recycle color when a member leaves the trip
   */
  static async recycleMemberColor(tripId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trip_members')
        .update({
          assigned_color_index: null,
          color_assigned_at: null
        })
        .eq('trip_id', tripId)
        .eq('user_id', userId);

      return !error;
    } catch (error) {
      console.error('Error recycling member color:', error);
      return false;
    }
  }

  /**
   * Get color by index (1-20)
   */
  static getColorByIndex(index: number): RefinedColor | null {
    if (index < 1 || index > 20) return null;
    return this.COLORS[index - 1];
  }

  /**
   * Get all available colors (static list)
   */
  static getAllColors(): RefinedColor[] {
    return [...this.COLORS];
  }

  /**
   * Get a simple color mapping for frontend use (member_id -> hex color)
   */
  static async getSimpleColorMapping(tripId: string): Promise<Record<string, string>> {
    try {
      const assignments = await this.getTripMemberColors(tripId);
      const mapping: Record<string, string> = {};
      
      assignments.forEach(assignment => {
        mapping[assignment.userId] = assignment.color.hex;
      });
      
      return mapping;
    } catch (error) {
      console.error('Error getting simple color mapping:', error);
      return {};
    }
  }

  /**
   * Auto-assign colors to all members who don't have one
   */
  static async autoAssignMissingColors(tripId: string): Promise<boolean> {
    try {
      const { data: members } = await supabase
        .from('trip_members')
        .select('user_id, assigned_color_index')
        .eq('trip_id', tripId);

      if (!members) return false;

      const membersWithoutColors = members.filter(m => !m.assigned_color_index);
      
      for (const member of membersWithoutColors) {
        try {
          await this.assignColorToMember(tripId, member.user_id);
        } catch (error) {
          console.error(`Failed to assign color to member ${member.user_id}:`, error);
        }
      }

      return true;
    } catch (error) {
      console.error('Error auto-assigning colors:', error);
      return false;
    }
  }

  /**
   * Get color for optimization results (fallback to index-based assignment)
   */
  static getColorForOptimization(memberId: string, memberColors: Record<string, string>): string {
    // First check if we have a specific color assignment
    if (memberColors[memberId]) {
      return memberColors[memberId];
    }

    // Fallback to deterministic color based on member ID
    const memberIndex = parseInt(memberId.replace(/\D/g, '')) || 1;
    const colorIndex = ((memberIndex - 1) % 20) + 1;
    return this.COLORS[colorIndex - 1].hex;
  }

  /**
   * Get contrasting text color for a background color
   */
  static getContrastColor(hexColor: string): string {
    // Remove # if present
    const color = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }

  /**
   * Get lighter/darker variants of a color for UI elements
   */
  static getColorVariants(hexColor: string): {
    light: string;
    dark: string;
    lighter: string;
    darker: string;
  } {
    const color = hexColor.replace('#', '');
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);

    const lighter = (value: number, factor: number) => 
      Math.min(255, Math.round(value + (255 - value) * factor));
    
    const darker = (value: number, factor: number) => 
      Math.max(0, Math.round(value * (1 - factor)));

    return {
      light: `#${lighter(r, 0.3).toString(16).padStart(2, '0')}${lighter(g, 0.3).toString(16).padStart(2, '0')}${lighter(b, 0.3).toString(16).padStart(2, '0')}`,
      dark: `#${darker(r, 0.3).toString(16).padStart(2, '0')}${darker(g, 0.3).toString(16).padStart(2, '0')}${darker(b, 0.3).toString(16).padStart(2, '0')}`,
      lighter: `#${lighter(r, 0.6).toString(16).padStart(2, '0')}${lighter(g, 0.6).toString(16).padStart(2, '0')}${lighter(b, 0.6).toString(16).padStart(2, '0')}`,
      darker: `#${darker(r, 0.6).toString(16).padStart(2, '0')}${darker(g, 0.6).toString(16).padStart(2, '0')}${darker(b, 0.6).toString(16).padStart(2, '0')}`
    };
  }

  /**
   * Validate color assignment constraints
   */
  static async validateColorAssignment(tripId: string): Promise<{
    valid: boolean;
    issues: string[];
    memberCount: number;
    maxColors: number;
  }> {
    try {
      const { data: members } = await supabase
        .from('trip_members')
        .select('user_id, assigned_color_index')
        .eq('trip_id', tripId);

      if (!members) {
        return {
          valid: false,
          issues: ['Failed to fetch trip members'],
          memberCount: 0,
          maxColors: 20
        };
      }

      const issues: string[] = [];
      const assignedColors = new Map<number, string[]>();

      // Check for duplicate color assignments
      members.forEach(member => {
        if (member.assigned_color_index) {
          if (!assignedColors.has(member.assigned_color_index)) {
            assignedColors.set(member.assigned_color_index, []);
          }
          assignedColors.get(member.assigned_color_index)!.push(member.user_id);
        }
      });

      // Report duplicates
      assignedColors.forEach((userIds, colorIndex) => {
        if (userIds.length > 1) {
          issues.push(`Color ${colorIndex} assigned to multiple members: ${userIds.join(', ')}`);
        }
      });

      // Check if member count exceeds color limit
      if (members.length > 20) {
        issues.push(`Trip has ${members.length} members but only 20 colors available`);
      }

      return {
        valid: issues.length === 0,
        issues,
        memberCount: members.length,
        maxColors: 20
      };
    } catch (error) {
      console.error('Error validating color assignment:', error);
      return {
        valid: false,
        issues: ['Validation failed due to database error'],
        memberCount: 0,
        maxColors: 20
      };
    }
  }
}