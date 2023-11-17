import {info} from '@actions/core'
import {octokit} from './octokit'

// https://stackoverflow.com/questions/27883893/github-api-how-to-check-if-user-has-write-access-to-a-repository
export const isCollaborator = async (user: string, repository: string) => {
  const [owner, repo] = repository.split('/')
  try {
    const res = await octokit.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: user
    })
    return ['admin', 'write'].includes(res.data.permission)
  } catch (e) {
    // raise error on 404
    info(
      `got error on isCollaborator ${e}. owner: ${owner} repo: ${repo} user: ${user}`
    )
    return false
  }
}
