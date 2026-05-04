export const GROUPS = [
  { id: 'A', teams: ['Mexico', 'South Korea', 'South Africa', 'Czechia'] },
  { id: 'B', teams: ['Canada', 'Switzerland', 'Qatar', 'Bosnia-Herzegovina'] },
  { id: 'C', teams: ['Brazil', 'Morocco', 'Scotland', 'Haiti'] },
  { id: 'D', teams: ['USA', 'Paraguay', 'Australia', 'Türkiye'] },
  { id: 'E', teams: ['Germany', 'Ecuador', 'Ivory Coast', 'Curaçao'] },
  { id: 'F', teams: ['Netherlands', 'Japan', 'Tunisia', 'Sweden'] },
  { id: 'G', teams: ['Belgium', 'Iran', 'Egypt', 'New Zealand'] },
  { id: 'H', teams: ['Spain', 'Uruguay', 'Saudi Arabia', 'Cape Verde'] },
  { id: 'I', teams: ['France', 'Senegal', 'Norway', 'Iraq'] },
  { id: 'J', teams: ['Argentina', 'Austria', 'Algeria', 'Jordan'] },
  { id: 'K', teams: ['Portugal', 'Colombia', 'Uzbekistan', 'DR Congo'] },
  { id: 'L', teams: ['England', 'Croatia', 'Panama', 'Ghana'] },
]

export const ALL_TEAMS = GROUPS.flatMap(g => g.teams)

export const TEAM_FLAGS = {
  // Group A
  'Mexico': '🇲🇽', 'South Korea': '🇰🇷', 'South Africa': '🇿🇦', 'Czechia': '🇨🇿',
  // Group B
  'Canada': '🇨🇦', 'Switzerland': '🇨🇭', 'Qatar': '🇶🇦', 'Bosnia-Herzegovina': '🇧🇦',
  // Group C
  'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Haiti': '🇭🇹',
  // Group D
  'USA': '🇺🇸', 'Paraguay': '🇵🇾', 'Australia': '🇦🇺', 'Türkiye': '🇹🇷',
  // Group E
  'Germany': '🇩🇪', 'Ecuador': '🇪🇨', 'Ivory Coast': '🇨🇮', 'Curaçao': '🇨🇼',
  // Group F
  'Netherlands': '🇳🇱', 'Japan': '🇯🇵', 'Tunisia': '🇹🇳', 'Sweden': '🇸🇪',
  // Group G
  'Belgium': '🇧🇪', 'Iran': '🇮🇷', 'Egypt': '🇪🇬', 'New Zealand': '🇳🇿',
  // Group H
  'Spain': '🇪🇸', 'Uruguay': '🇺🇾', 'Saudi Arabia': '🇸🇦', 'Cape Verde': '🇨🇻',
  // Group I
  'France': '🇫🇷', 'Senegal': '🇸🇳', 'Norway': '🇳🇴', 'Iraq': '🇮🇶',
  // Group J
  'Argentina': '🇦🇷', 'Austria': '🇦🇹', 'Algeria': '🇩🇿', 'Jordan': '🇯🇴',
  // Group K
  'Portugal': '🇵🇹', 'Colombia': '🇨🇴', 'Uzbekistan': '🇺🇿', 'DR Congo': '🇨🇩',
  // Group L
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷', 'Panama': '🇵🇦', 'Ghana': '🇬🇭',
}

export const WILDCARD_COUNT = 8
export const TOTAL_GROUPS = 12
