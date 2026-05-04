export const GROUPS = [
  {
    id: 'A',
    teams: ['USA', 'Mexico', 'Canada', 'Panama'],
  },
  {
    id: 'B',
    teams: ['Argentina', 'Ecuador', 'Chile', 'Peru'],
  },
  {
    id: 'C',
    teams: ['Brazil', 'Colombia', 'Paraguay', 'Bolivia'],
  },
  {
    id: 'D',
    teams: ['England', 'France', 'Netherlands', 'Belgium'],
  },
  {
    id: 'E',
    teams: ['Spain', 'Portugal', 'Croatia', 'Morocco'],
  },
  {
    id: 'F',
    teams: ['Germany', 'Italy', 'Switzerland', 'Cameroon'],
  },
  {
    id: 'G',
    teams: ['Japan', 'South Korea', 'Australia', 'Saudi Arabia'],
  },
  {
    id: 'H',
    teams: ['Uruguay', 'Venezuela', 'Jamaica', 'Costa Rica'],
  },
  {
    id: 'I',
    teams: ['Senegal', 'Nigeria', 'Egypt', 'Ivory Coast'],
  },
  {
    id: 'J',
    teams: ['Iran', 'Iraq', 'Qatar', 'Uzbekistan'],
  },
  {
    id: 'K',
    teams: ['New Zealand', 'Honduras', 'Cuba', 'Trinidad & Tobago'],
  },
  {
    id: 'L',
    teams: ['Tunisia', 'Algeria', 'DR Congo', 'South Africa'],
  },
]

export const ALL_TEAMS = GROUPS.flatMap(g => g.teams)

export const TEAM_FLAGS = {
  'USA': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦', 'Panama': '🇵🇦',
  'Argentina': '🇦🇷', 'Ecuador': '🇪🇨', 'Chile': '🇨🇱', 'Peru': '🇵🇪',
  'Brazil': '🇧🇷', 'Colombia': '🇨🇴', 'Paraguay': '🇵🇾', 'Bolivia': '🇧🇴',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'France': '🇫🇷', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
  'Spain': '🇪🇸', 'Portugal': '🇵🇹', 'Croatia': '🇭🇷', 'Morocco': '🇲🇦',
  'Germany': '🇩🇪', 'Italy': '🇮🇹', 'Switzerland': '🇨🇭', 'Cameroon': '🇨🇲',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Australia': '🇦🇺', 'Saudi Arabia': '🇸🇦',
  'Uruguay': '🇺🇾', 'Venezuela': '🇻🇪', 'Jamaica': '🇯🇲', 'Costa Rica': '🇨🇷',
  'Senegal': '🇸🇳', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬', 'Ivory Coast': '🇨🇮',
  'Iran': '🇮🇷', 'Iraq': '🇮🇶', 'Qatar': '🇶🇦', 'Uzbekistan': '🇺🇿',
  'New Zealand': '🇳🇿', 'Honduras': '🇭🇳', 'Cuba': '🇨🇺', 'Trinidad & Tobago': '🇹🇹',
  'Tunisia': '🇹🇳', 'Algeria': '🇩🇿', 'DR Congo': '🇨🇩', 'South Africa': '🇿🇦',
}

export const WILDCARD_COUNT = 8
export const TOTAL_GROUPS = 12
