import {octokit} from './octokit'

// https://stackoverflow.com/questions/27883893/github-api-how-to-check-if-user-has-write-access-to-a-repository
export const isCollaborator = async (user: string, repository: string) => {
  const [owner, repo] = repository.split('/')
  const res = await octokit.repos.checkCollaborator({
    owner,
    repo,
    username: user
  })
  return res.status === 204
}
