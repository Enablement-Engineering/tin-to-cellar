import '../styles/inspiration.css'

const channels = [
  {
    name: 'Hobbiton Piper',
    image: 'hobbiton',
    mediaLabel: 'Watch Smoke With Me',
    mediaLink: 1,
    format: 'video',
    description: 'Relaxed “smoke with me” sessions, thoughtful descriptions of blends, and conversations about life.',
    links: [
      ['YouTube', 'https://www.youtube.com/@hobbitonpiper'],
      ['Watch Smoke With Me', 'https://www.youtube.com/playlist?list=PLdvgpTWPfVMDGzaXfxBeBix6t0KnS8fLG'],
    ],
  },
  {
    name: 'Smokingpipes & Cornell & Diehl',
    image: 'smokingpipes',
    mediaLabel: 'Explore Smokingpipes',
    mediaLink: 0,
    format: 'channel',
    description: 'Blend reviews, maker interviews, and practical guides from the retailer and tobacco maker. A window into the Laudisi world.',
    links: [
      ['Smokingpipes on YouTube', 'https://www.youtube.com/@Smokingpipes'],
      ['Cornell & Diehl on YouTube', 'https://www.youtube.com/@cornelldiehlinc9213'],
    ],
  },
  {
    name: 'Puffin',
    image: 'puffin',
    mediaLabel: 'Watch a favorite review',
    mediaLink: 2,
    format: 'video',
    description: 'Thorough blend reviews with excellent historical context and scientific explanations.',
    links: [
      ['YouTube', 'https://www.youtube.com/@puffin.reviews'],
      ['Review website', 'https://puffin.reviews/'],
      ['Start with this video', 'https://www.youtube.com/watch?v=aFfUU0lpb1M'],
    ],
  },
  {
    name: 'East Texas Pipe Club',
    image: 'east-texas',
    mediaLabel: 'Watch a favorite video',
    mediaLink: 1,
    format: 'video',
    description: 'Thoughtful video essays and blend reviews.',
    links: [
      ['YouTube', 'https://www.youtube.com/@EastTexasPipeClub'],
      ['Start with this video', 'https://www.youtube.com/watch?v=9kcQEPmlI9I'],
    ],
  },
  {
    name: 'The Carolina Pipe',
    image: 'carolina',
    mediaLabel: 'Explore the channel',
    mediaLink: 0,
    format: 'channel',
    description: 'Daily videos with practical tips for everyday pipe smoking.',
    links: [['YouTube', 'https://www.youtube.com/@TheCarolinaPipe']],
  },
  {
    name: 'Muttnchop Piper',
    image: 'muttnchop',
    mediaLabel: 'Watch the breath method',
    mediaLink: 1,
    format: 'video',
    description: 'A longtime voice in the YouTube pipe community, with excellent practical guides and well-known explanations of the breath method.',
    links: [
      ['YouTube', 'https://www.youtube.com/@MuttnchopPiper'],
      ['Watch the breath method', 'https://www.youtube.com/watch?v=c3vrBFnq7Xo'],
    ],
  },
  {
    name: 'Get Piped',
    image: 'get-piped',
    mediaLabel: 'Listen on Spotify',
    mediaLink: 1,
    format: 'podcast',
    description: 'Blend reviews, video essays, and a podcast for longer listening.',
    links: [
      ['YouTube', 'https://www.youtube.com/@GetPiped'],
      ['Listen on Spotify', 'https://open.spotify.com/show/7EYz1tvjLu2hGIZeCWwV9m'],
    ],
  },
]

const reading = [
  {
    name: 'r/PipeTobacco wiki',
    purpose: 'Find an answer',
    description: 'Community-written answers to common questions about pipes and tobacco.',
    url: 'https://www.reddit.com/r/PipeTobacco/wiki/index/',
  },
  {
    name: 'Tobacco Reviews',
    purpose: 'Research a blend',
    description: 'Look up a blend and compare tasting notes from different reviewers.',
    url: 'https://www.tobaccoreviews.com/',
  },
  {
    name: 'Smokingpipes cellaring guide',
    purpose: 'Plan your cellar',
    description: 'A starting point for storing and aging the tobacco in your collection.',
    url: 'https://www.smokingpipes.com/smokingpipesblog/single.cfm/post/introduction-cellaring-pipe-tobacco',
  },
  {
    name: 'Briar Report directory',
    purpose: 'Meet more creators',
    description: 'Find more pipe channels to explore. The directory is not regularly checked for inactive channels or broken links.',
    url: 'https://briarreport.com/directory/',
  },
]

export function Inspiration() {
  return <article className="editorial-page inspiration-page screen-only">
    <header className="editorial-header">
      <h1>Inspiration & resources</h1>
      <p className="editorial-lede">The guide that started Tin to Cellar, and some favorite voices and resources from the pipe community.</p>
    </header>
    <div className="editorial-body">
      <section>
        <h2>Inspired by Hobbiton Piper</h2>
        <p>His guide to making labels for pipe tobacco jars was the starting point for Tin to Cellar.</p>
      </section>
      <iframe
        className="inspiration-video"
        width="560"
        height="315"
        src="https://www.youtube-nocookie.com/embed/2zPQSh5kHHQ"
        title="Hobbiton Piper: How To Make Cellar Labels For Pipe Tobacco Jars"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture; web-share"
        allowFullScreen
      />
      <a className="inspiration-source" href="https://www.youtube.com/watch?v=2zPQSh5kHHQ">
        <strong>How To Make Cellar Labels For Pipe Tobacco Jars (Step By Step Guide)</strong>
        <span>Hobbiton Piper · Watch on YouTube <span aria-hidden="true">↗</span></span>
      </a>
      <section>
        <h2>A label worth keeping</h2>
        <p>In his 2021 guide, Hobbiton Piper arranges blend artwork in Microsoft Word, prints it on paper, then cuts out the labels and glues them to jar lids. He adds the year by hand.</p>
      </section>
      <section>
        <h2>From that guide to this app</h2>
        <p>Tin to Cellar follows that idea. Choose community designs or adapt the tin artwork in your own AI chat, then print the labels together. Each label leaves room to add the date by hand.</p>
        <p>Thank you, Hobbiton Piper, for sharing the method that inspired this project.</p>
      </section>
      <section className="inspiration-collection" aria-labelledby="inspiration-watch">
        <h2 id="inspiration-watch">People worth spending time with</h2>
        <p>Channels we enjoy, with a few favorite places to start.</p>
        <ul className="inspiration-channels">
          {channels.map(channel => <li className={`inspiration-card inspiration-card--${channel.format}`} key={channel.name}>
            <a className="inspiration-media" href={channel.links[channel.mediaLink][1]} aria-label={`${channel.name}: ${channel.mediaLabel}`}>
              <img src={`/images/inspiration/${channel.image}.jpg`} alt="" width={channel.format === 'video' ? 480 : 300} height={channel.format === 'video' ? 360 : 300} loading="lazy" decoding="async" />
              <span className="inspiration-media-caption">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                {channel.mediaLabel}
              </span>
            </a>
            <div className="inspiration-card-copy">
              <h3>{channel.name}</h3>
              <p>{channel.description}</p>
              <ul className="inspiration-resource-links" aria-label={`${channel.name} links`}>
                {channel.links.filter((_, index) => index !== channel.mediaLink || channel.format === 'channel').map(([label, url]) => <li key={url}>
                  <a href={url} aria-label={`${channel.name}: ${label}`}>{label}</a>
                </li>)}
              </ul>
            </div>
          </li>)}
        </ul>
      </section>
      <section className="inspiration-collection" aria-labelledby="inspiration-read">
        <h2 id="inspiration-read">Read & explore</h2>
        <ul className="inspiration-resources">
          {reading.map(resource => <li key={resource.url}>
            <span className="inspiration-resource-purpose">{resource.purpose}</span>
            <h3><a href={resource.url}>{resource.name}</a></h3>
            <p>{resource.description}</p>
          </li>)}
        </ul>
      </section>
    </div>
  </article>
}
