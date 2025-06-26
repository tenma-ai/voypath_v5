/**
 * Place Color Calculator - Smart Color Logic for Places
 * Handles gradient calculation for 2-4 member contributions and gold for 5+
 */

import { RefinedColor } from '../services/MemberColorService';

export interface MemberContribution {
  userId: string;
  userName: string;
  color: RefinedColor;
  weight: number; // 0-1, contribution weight
}

export interface PlaceColorResult {
  displayColor: string;
  colorType: 'single' | 'gradient' | 'gold';
  memberContributions: MemberContribution[];
  cssGradient?: string;
  goldReason?: string;
}

export class PlaceColorCalculator {
  private static readonly GOLD_COLOR = '#FFD700';
  private static readonly GOLD_GRADIENT = 'linear-gradient(45deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)';

  /**
   * Calculate the display color for a place based on member contributions
   */
  static calculatePlaceColor(
    memberContributions: MemberContribution[]
  ): PlaceColorResult {
    const contributorCount = memberContributions.length;

    // No contributors - use default gray
    if (contributorCount === 0) {
      return {
        displayColor: '#9CA3AF',
        colorType: 'single',
        memberContributions: [],
      };
    }

    // Single contributor - use their color
    if (contributorCount === 1) {
      return {
        displayColor: memberContributions[0].color.hex,
        colorType: 'single',
        memberContributions,
      };
    }

    // 5+ contributors - use gold
    if (contributorCount >= 5) {
      return {
        displayColor: this.GOLD_COLOR,
        colorType: 'gold',
        memberContributions,
        cssGradient: this.GOLD_GRADIENT,
        goldReason: `Place added by ${contributorCount} members`,
      };
    }

    // 2-4 contributors - create gradient
    const gradient = this.generateGradient(memberContributions);
    
    return {
      displayColor: memberContributions[0].color.hex, // Primary color for compatibility
      colorType: 'gradient',
      memberContributions,
      cssGradient: gradient,
    };
  }

  /**
   * Generate CSS gradient for 2-4 member contributions
   */
  static generateGradient(contributions: MemberContribution[]): string {
    if (contributions.length < 2) {
      return `linear-gradient(0deg, ${contributions[0]?.color.hex || '#9CA3AF'} 100%)`;
    }

    if (contributions.length > 4) {
      return this.GOLD_GRADIENT;
    }

    // Sort by weight (highest first) for better visual distribution
    const sortedContributions = [...contributions].sort((a, b) => b.weight - a.weight);

    // Calculate equal divisions for gradient stops
    const stops: string[] = [];
    const angleMap = {
      2: 90,   // Vertical split for 2 members
      3: 120,  // Diagonal for 3 members  
      4: 45,   // Diagonal for 4 members
    };

    const angle = angleMap[contributions.length as keyof typeof angleMap] || 45;
    const segmentSize = 100 / contributions.length;

    sortedContributions.forEach((contribution, index) => {
      const startPos = index * segmentSize;
      const endPos = (index + 1) * segmentSize;
      
      if (index === 0) {
        stops.push(`${contribution.color.hex} ${startPos}%`);
      }
      
      stops.push(`${contribution.color.hex} ${endPos}%`);
    });

    return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
  }

  /**
   * Get gold color for 5+ member places
   */
  static getGoldColor(): string {
    return this.GOLD_COLOR;
  }

  /**
   * Get gold gradient for 5+ member places
   */
  static getGoldGradient(): string {
    return this.GOLD_GRADIENT;
  }

  /**
   * Calculate member contribution weights based on various factors
   */
  static calculateContributionWeights(
    placeData: {
      addedBy: string;
      wishLevels: { userId: string; wishLevel: number }[];
      editHistory: { userId: string; editCount: number }[];
      comments: { userId: string; commentCount: number }[];
    }
  ): { userId: string; weight: number }[] {
    const weights = new Map<string, number>();

    // Base weight for adding the place
    weights.set(placeData.addedBy, 0.4);

    // Weight for wish levels (normalized)
    const maxWishLevel = Math.max(...placeData.wishLevels.map(w => w.wishLevel));
    placeData.wishLevels.forEach(wish => {
      const existingWeight = weights.get(wish.userId) || 0;
      const wishWeight = (wish.wishLevel / maxWishLevel) * 0.3;
      weights.set(wish.userId, existingWeight + wishWeight);
    });

    // Weight for edit contributions
    const maxEdits = Math.max(...placeData.editHistory.map(e => e.editCount));
    if (maxEdits > 0) {
      placeData.editHistory.forEach(edit => {
        const existingWeight = weights.get(edit.userId) || 0;
        const editWeight = (edit.editCount / maxEdits) * 0.2;
        weights.set(edit.userId, existingWeight + editWeight);
      });
    }

    // Weight for comments/engagement
    const maxComments = Math.max(...placeData.comments.map(c => c.commentCount));
    if (maxComments > 0) {
      placeData.comments.forEach(comment => {
        const existingWeight = weights.get(comment.userId) || 0;
        const commentWeight = (comment.commentCount / maxComments) * 0.1;
        weights.set(comment.userId, existingWeight + commentWeight);
      });
    }

    // Normalize weights to sum to 1.0
    const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
    const normalizedWeights: { userId: string; weight: number }[] = [];

    weights.forEach((weight, userId) => {
      normalizedWeights.push({
        userId,
        weight: totalWeight > 0 ? weight / totalWeight : 0
      });
    });

    return normalizedWeights.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Generate CSS for place marker styling
   */
  static generateMarkerCSS(colorResult: PlaceColorResult): {
    backgroundColor: string;
    background: string;
    border: string;
    boxShadow: string;
  } {
    const baseStyles = {
      border: `2px solid rgba(255, 255, 255, 0.8)`,
      boxShadow: `0 2px 8px rgba(0, 0, 0, 0.3)`,
    };

    switch (colorResult.colorType) {
      case 'single':
        return {
          ...baseStyles,
          backgroundColor: colorResult.displayColor,
          background: colorResult.displayColor,
        };

      case 'gradient':
        return {
          ...baseStyles,
          backgroundColor: colorResult.displayColor,
          background: colorResult.cssGradient || colorResult.displayColor,
        };

      case 'gold':
        return {
          ...baseStyles,
          backgroundColor: this.GOLD_COLOR,
          background: this.GOLD_GRADIENT,
          border: `2px solid #FFA500`,
          boxShadow: `0 2px 8px rgba(255, 215, 0, 0.5)`,
        };

      default:
        return {
          ...baseStyles,
          backgroundColor: '#9CA3AF',
          background: '#9CA3AF',
        };
    }
  }

  /**
   * Generate accessibility-friendly color descriptions
   */
  static generateColorDescription(colorResult: PlaceColorResult): string {
    switch (colorResult.colorType) {
      case 'single':
        const singleContributor = colorResult.memberContributions[0];
        return `${singleContributor.color.name} (added by ${singleContributor.userName})`;

      case 'gradient':
        const contributorNames = colorResult.memberContributions
          .map(c => c.userName)
          .join(', ');
        return `Gradient of ${contributorNames}`;

      case 'gold':
        return `Gold (${colorResult.memberContributions.length} contributors)`;

      default:
        return 'No color assigned';
    }
  }

  /**
   * Update place color metadata in database format
   */
  static formatForDatabase(colorResult: PlaceColorResult): {
    display_color: string;
    member_contribution: any;
  } {
    return {
      display_color: colorResult.displayColor,
      member_contribution: {
        type: colorResult.colorType,
        contributors: colorResult.memberContributions.map(c => ({
          user_id: c.userId,
          user_name: c.userName,
          color_hex: c.color.hex,
          color_name: c.color.name,
          weight: c.weight,
        })),
        css_gradient: colorResult.cssGradient,
        gold_reason: colorResult.goldReason,
        generated_at: new Date().toISOString(),
      },
    };
  }
}